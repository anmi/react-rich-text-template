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
        {"token": "string", "value": "Hey, "},
        {"token": "textPlaceholder", "value": "{username}"},
        {"token": "string", "value": ","},
        {"token": "selfClosingTag", "value": "<br/>"},
        {"token": "string", "value": " "},
        {"token": "openingTag", "value": "<p>"},
        {"token": "string", "value": "checkout new "},
        {"token": "openingTag", "value": "<link>"},
        {"token": "string", "value": "features"},
        {"token": "closingTag", "value": "</link>"},
        {"token": "string", "value": "!"},
        {"token": "closingTag", "value": "</p>"}
      ]
    );
  });
});

describe('Abstract syntax tree builder', function() {
  it('should build tree', function() {
    should(rrtt.buildTree).be.an.instanceOf(Function);

    var tokens = rrtt.tokenize(tokensCategories, str);
    var tree = rrtt.buildTree(tokens, opts);

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
            "elements": [
              {"type": "string", "value": "checkout new "},
              {
                "type": "openingTag",
                "value": "link",
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
});

describe('Injector', function() {
  it('should inject arguments into tree', function() {
    var tokens = rrtt.tokenize(tokensCategories, str);
    var tree = rrtt.buildTree(tokens, opts);

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
});
