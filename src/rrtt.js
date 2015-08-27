var defaultConfig = {
  stringWrapper: function(elem) {
    return elem;
  },
  tokenValuesExtractors: {
    openingTag: function(str) {
      return str.slice(1, -1);
    },
    closingTag: function(str) {
      return str.slice(2, -1);
    },
    selfClosingTag: function(str) {
      return str.slice(1, -2);
    },
    textPlaceholder: function(str) {
      return str.slice(1, -1);
    }
  },
  openingTagRegexp: /(<[^\>\/]+>)/g,
  closingTagRegexp: /(<\/[^\>\/]+>)/g,
  selfClosingTagRegexp: [
    {type: 'selfClosingTag', regexp: /(<[^\>\/]+\/>)/g},
    {type: 'textPlaceholder', regexp: /(\{[^\{\}]+\})/g}
  ],
  matchOpenAndClosingTagPair: function(opening, closing, conf) {
    return conf.tokenValuesExtractors.openingTag(opening) ==
        conf.tokenValuesExtractors.closingTag(closing);
  }
};

function flattern(array) {
  var flatternArray = [];

  array.forEach(function(elem) {
    if (elem.constructor === Array) {
      flatternArray = flatternArray.concat(elem);
    } else {
      flatternArray.push(elem);
    }
  });

  return flatternArray;
}

function formatTemplateError(error, template, position) {
  return error + '\n' +
  template + '\n' +
  Array(position + 1).join('-') + '^';
}

//
// tokens:
// [{regexp: /regexp/g, name: 'tokenname'}]

function _tokenize(tokensCategories, str) {
  if (tokensCategories.length === 0) {
    if (str.length === 0) {
      return [];
    } else {
      return [{token: 'string', value: str}];
    }
  }
  var firstTokenCategory = tokensCategories[0],
    otherTokensCategories = tokensCategories.slice(1);

  var newTokensArray = [];

  return flattern(
    str.split(firstTokenCategory.regexp)
      .map(function(token) {
        if (firstTokenCategory.regexp.test(token)) {
          return {
            token: firstTokenCategory.type,
            value: token
          };
        } else {
          return _tokenize(otherTokensCategories, token);
        }
      })
  );
}

// TODO: escape tokens
function tokenize(tokensCategories, str) {
  var tokensWithIndex = [],
    index = 0;

  _tokenize(
    tokensCategories,
    str
  ).forEach(function(token) {
    tokensWithIndex.push({
      token: token.token,
      value: token.value,
      position: index
    });

    index += token.value.length;
  });

  return tokensWithIndex;
}

function buildTree(tokens, opts, template) {
  var currentLevel = {
      elements: []
    },
    root = currentLevel,
    stack = [root];

  tokens.forEach(function(token) {
    switch (token.token) {
      case 'string':
        currentLevel.elements.push({
          type: token.token,
          value: token.value
        });
        break;
      case 'textPlaceholder':
        currentLevel.elements.push({
          type: token.token,
          value: opts.tokenValuesExtractors
            .textPlaceholder(token.value)
        });
        break;
      case 'selfClosingTag':
        currentLevel.elements.push({
          type: token.token,
          value: opts.tokenValuesExtractors
            .selfClosingTag(token.value)
        });
        break;
      case 'openingTag':
        var newLevel = {
          type: token.token,
          tokenValue: token.value,
          value: opts.tokenValuesExtractors
            .openingTag(token.value),
          elements: []
        };
        stack.push(newLevel);
        currentLevel.elements.push(newLevel);
        currentLevel = newLevel;
        break;
      case 'closingTag':
        if (stack.length <= 1) {
          throw Error(formatTemplateError(
            'Nothing to close by closeTag',
            template,
            token.position
          ));
        } else if (!opts.matchOpenAndClosingTagPair(
              currentLevel.tokenValue,
              token.value,
              opts
            )) {
          throw Error(formatTemplateError(
            'Closing tag doesn\'t match opening',
            template,
            token.position
          ));
        }

        stack.pop();
        currentLevel = stack[stack.length - 1];
        break;
    }
  });

  if (currentLevel !== root) {
    throw Error(formatTemplateError(
      'Expected closing tag',
      template,
      template.length
    ));
  }

  return root;
}

function moveStringsToResult(stringsQueue, opts, result) {
  if (stringsQueue.length > 0) {
    result.push(
      opts.stringWrapper(
        stringsQueue.join(''),
        result.length
      )
    );
  }
}

function inject(node, opts, data) {
  var result = [],
    stringsQueue = [];

  node.elements.map(function(elem) {
    if (elem.type === 'string') {
      stringsQueue.push(elem.value);
    }
    if (elem.type === 'textPlaceholder') {
      if (typeof data[elem.value] !== 'undefined') {
        if (typeof data[elem.value] === 'string') {
          stringsQueue.push(data[elem.value]);
        } else if (typeof data[elem.value] === 'number') {
          stringsQueue.push('' + data[elem.value]);
        } else {
          moveStringsToResult(stringsQueue, opts, result);
          stringsQueue = [];
          result.push(data[elem.value]);
        }
      } else if (typeof opts.processMissingParam === 'function') {
        moveStringsToResult(stringsQueue, opts, result);
        stringsQueue = [];
        result.push(opts.processMissingParam(
          elem.value,
          [],
          result.length
        ));
      }
    }
    if (elem.type === 'selfClosingTag') {
      moveStringsToResult(stringsQueue, opts, result);
      stringsQueue = [];
      if (typeof data[elem.value] === 'function') {
        result.push(data[elem.value](result.length));
      } else if (typeof opts.processMissingParam === 'function') {
        result.push(opts.processMissingParam(
          elem.value,
          [],
          result.length
        ));
      }
    }
    if (elem.type === 'openingTag') {
      moveStringsToResult(stringsQueue, opts, result);
      stringsQueue = [];
      if (typeof data[elem.value] === 'function') {
        result.push(data[elem.value](
          inject(elem, opts, data),
          result.length
        ));
      } else if (typeof opts.processMissingParam === 'function') {
        result.push(opts.processMissingParam(
          elem.value,
          inject(elem, opts, data),
          result.length
        ));
      }
    }
  });

  moveStringsToResult(stringsQueue, opts, result);

  return result;
}

function compile(template, opts) {
  if (!opts) {
    opts = defaultConfig;
  }

  var tokensCategories = [
      {type: 'openingTag', regexp: opts.openingTagRegexp},
      {type: 'closingTag', regexp: opts.closingTagRegexp}
    ].concat(opts.selfClosingTagRegexp);

  var rootNode = buildTree(
      tokenize(tokensCategories, template),
      opts,
      template
    );

  return function(context) {
    return inject(rootNode, opts, context);
  }
}

module.exports = {
  defaultConfig: defaultConfig,
  compile: compile,
  buildTree: buildTree,
  tokenize: tokenize,
  inject: inject
};
