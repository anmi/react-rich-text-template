'use strict';

var should = require('should'),
  rrtt = require('../src/rrtt'),
  chai = require('chai');

var opts = rrtt.defaultConfig;

var tokensCategories = [
    {type: 'openingTag', regexp: opts.openingTagRegexp},
    {type: 'closingTag', regexp: opts.closingTagRegexp}
  ].concat(opts.selfClosingTagRegexp)

var str = "Hey, {username},<br/>" +
  " <p>checkout new <link>features</link>!</p>";

describe('Tokenizer', function() {
  it('should split string into tokens', function() {
    should(rrtt.tokenize).be.an.instanceOf(Function);

    var tokens = rrtt.tokenize(tokensCategories, str);

    chai.assert.deepEqual(
      tokens,
      [
        {"token": "string", "value": "Hey, ", position: 0},
        {"token": "textPlaceholder", "value": "{username}", position: 5},
        {"token": "string", "value": ",", position: 15},
        {"token": "selfClosingTag", "value": "<br/>", position: 16},
        {"token": "string", "value": " ", position: 21},
        {"token": "openingTag", "value": "<p>", position: 22},
        {"token": "string", "value": "checkout new ", position: 25},
        {"token": "openingTag", "value": "<link>", position: 38},
        {"token": "string", "value": "features", position: 44},
        {"token": "closingTag", "value": "</link>", position: 52},
        {"token": "string", "value": "!", position: 59},
        {"token": "closingTag", "value": "</p>", position: 60}
      ]
    );
  });
});

describe('Abstract syntax tree builder', function() {
  it('should build tree', function() {
    should(rrtt.buildTree).be.an.instanceOf(Function);

    var tokens = rrtt.tokenize(tokensCategories, str);
    var tree = rrtt.buildTree(tokens, opts, str);

    chai.assert.deepEqual(
      tree,
      {
        "elements": [
          {"type": "string", "value": "Hey, "},
          {"type": "textPlaceholder", "value": "username"},
          {"type": "string", "value": ","},
          {"type": "selfClosingTag", "value": "br"},
          {"type": "string", "value": " "},
          {
            "type": "openingTag",
            "value": "p",
            "tokenValue": "<p>",
            "elements": [
              {"type": "string", "value": "checkout new "},
              {
                "type": "openingTag",
                "value": "link",
                "tokenValue": "<link>",
                "elements": [
                  {"type": "string", "value": "features"}
                ]
              },
              {"type": "string", "value": "!"}
            ]
          }
        ]
      }
    );
    //var tree = rrtt.buildTree(
  });

  it('should handle extra closing token', function() {
    var str = 'This <a>token</a> </b> is invalid';

    var tokens = rrtt.tokenize(tokensCategories, str);

    chai.expect(rrtt.buildTree.bind(null, tokens, opts, str)).to.throw(
      Error,
      'Nothing to close by closeTag\n' +
      'This <a>token</a> </b> is invalid\n' +
      '------------------^'
    );
  });

  it('should handle wrong closing token', function() {
    var str = 'This <a>token</b> </a> is invalid';

    var tokens = rrtt.tokenize(tokensCategories, str);

    chai.expect(rrtt.buildTree.bind(null, tokens, opts, str)).to.throw(
      Error,
      'Closing tag doesn\'t match opening\n' +
      'This <a>token</b> </a> is invalid\n' +
      '-------------^'
    );
  });

  it('should handle missing closing token', function() {
    var str = 'This <a>token';

    var tokens = rrtt.tokenize(tokensCategories, str);

    chai.expect(rrtt.buildTree.bind(null, tokens, opts, str)).to.throw(
      Error,
      'Expected closing tag\n' +
      'This <a>token\n' +
      '-------------^'
    );
  });
});

describe('Injector', function() {
  it('should inject arguments into tree', function() {
    var tokens = rrtt.tokenize(tokensCategories, str);
    var tree = rrtt.buildTree(tokens, opts, str);

    var result = rrtt.inject(tree, opts, {
      username: 'anmi',
      br: function() {
        return {nextLineComponent: true};
      },
      p: function(content) {
        return {
          paragraphComponent: true,
          children: content
        }
      },
      link: function(content) {
        return {
          linkComponent: true,
          text: content
        }
      }
    });

    chai.assert.deepEqual(
      result,
      [
        "Hey, anmi,",
        {nextLineComponent: true}, " ",
        {
          paragraphComponent: true,
          children: [
            "checkout new ",
            {linkComponent: true, text: ["features"]}, "!"
          ]
        }
      ]
    );
  });
});

describe('Template compiler', function() {
  it('should compile template and run', function() {
    var template = '<it>{status}</it>';
    var context = {
      it: function(ctx) {
        return {"It's": ctx[0]}
      },
      'status': 'alive!'
    };

    chai.assert.deepEqual(
      rrtt.compile(template)(context),
      [{"It's": "alive!"}]
    );
  });

  it('should pass index into wrapper', function() {
    var template = 'test <foo>indexed</foo>output<br/>t';

    var opts = Object.create(rrtt.defaultConfig);

    opts.stringWrapper = function(string, index) {
      return {
        tag: 'span',
        text: string,
        key: index
      };
    }

    chai.assert.deepEqual(
      rrtt.compile(template, opts)({
        foo: function(children, index) {
          return {
            tag: 'foo',
            children: children,
            key: index
          }
        },
        br: function(index) {
          return {
            tag: 'br',
            key: index
          }
        }
      }),
      [
        {
          tag: 'span',
          text: 'test ',
          key: 0
        },
        {
          tag: 'foo',
          children: [{
            tag: 'span',
            text: 'indexed',
            key: 0
          }],
          key: 1
        },
        {
          tag: 'span',
          text: 'output',
          key: 2
        },
        {
          tag: 'br',
          key: 3
        },
        {
          tag: 'span',
          text: 't',
          key: 4
        }
      ]
    );
  });

  it('should pass object in text placeholder', function() {
    var template = '<it>{status}</it>';
    var context = {
      it: function(ctx) {
        return {"It's": ctx[0]}
      },
      'status': {
        content: 'alive!'
      }
    };

    chai.assert.deepEqual(
      rrtt.compile(template)(context),
      [{
        "It's": {
          content: "alive!"
        }
      }]
    );
  });

  it('should convert numbers into strings', function() {
    var template = '{count} apples'
    var context = {
      count: 5
    };
    chai.assert.deepEqual(
      rrtt.compile(template)(context),
      ['5 apples']
    );
  });
});

describe('processMissingParam', function() {
  it('should handle missing param', function() {
    var template = 'test <foo>indexed</foo>output<br/>t';

    var opts = Object.create(rrtt.defaultConfig);

    opts.stringWrapper = function(string, index) {
      return {
        tag: 'span',
        text: string,
        key: index
      };
    };

    opts.processMissingParam = function(paramName, children, index) {
      return {
        tag: 'missingParam',
        paramName: paramName,
        key: index
      };
    }

    chai.assert.deepEqual(
      rrtt.compile(template, opts)({
        br: function(index) {
          return {tag: 'br', key: index};
        }
      }),
      [
        {tag: 'span', text: 'test ', key: 0},
        {tag: 'missingParam', paramName: 'foo', key: 1},
        {tag: 'span', text: 'output', key: 2},
        {tag: 'br', key: 3},
        {tag: 'span', text: 't', key: 4}
      ]
    );
  });

  it('should handle self-closing tag', function() {
    var template = 'test <foo>indexed</foo>output<br/>t';

    var opts = Object.create(rrtt.defaultConfig);

    opts.stringWrapper = function(string, index) {
      return {
        tag: 'span',
        text: string,
        key: index
      };
    };

    opts.processMissingParam = function(paramName, children, index) {
      return {
        tag: 'missingParam',
        paramName: paramName,
        key: index
      };
    }

    chai.assert.deepEqual(
      rrtt.compile(template, opts)({
      }),
      [
        {tag: 'span', text: 'test ', key: 0},
        {tag: 'missingParam', paramName: 'foo', key: 1},
        {tag: 'span', text: 'output', key: 2},
        {tag: 'missingParam', paramName: 'br', key: 3},
        {tag: 'span', text: 't', key: 4}
      ]
    );
  });

  it('should handle text placeholder', function() {
    var template = 'Hello {world}!';

    var opts = Object.create(rrtt.defaultConfig);

    opts.stringWrapper = function(string, index) {
      return {
        tag: 'span',
        text: string,
        key: index
      };
    };

    opts.processMissingParam = function(paramName, children, index) {
      return {
        tag: 'missingParam',
        paramName: paramName,
        key: index
      };
    }

    chai.assert.deepEqual(
      rrtt.compile(template, opts)({
      }),
      [
        {tag: 'span', text: 'Hello ', key: 0},
        {tag: 'missingParam', paramName: 'world', key: 1},
        {tag: 'span', text: '!', key: 2}
      ]
    );
  });
});
