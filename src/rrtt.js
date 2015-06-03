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
  ]
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
  return _tokenize(
    tokensCategories,
    str
  );
}

function buildTree(tokens, opts) {
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
          value: opts.tokenValuesExtractors
            .openingTag(token.value),
          elements: []
        };
        stack.push(newLevel);
        currentLevel.elements.push(newLevel);
        currentLevel = newLevel;
        break;
      case 'closingTag':
        stack.pop();
        currentLevel = stack[stack.length - 1];
        break;
    }
  });

  return root;
}

function moveStringsToResult(stringsQueue, opts, result) {
  if (stringsQueue.length > 0) {
    result.push(
      opts.stringWrapper(
        stringsQueue.join('')
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
      stringsQueue.push(data[elem.value]);
    }
    if (elem.type === 'selfClosingTag') {
      moveStringsToResult(stringsQueue, opts, result);
      stringsQueue = [];
      result.push(data[elem.value]());
    }
    if (elem.type === 'openingTag') {
      moveStringsToResult(stringsQueue, opts, result);
      stringsQueue = [];
      result.push(data[elem.value](
        inject(elem, opts, data)
      ));
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
      opts
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
