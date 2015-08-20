# react-rich-text-template
[![Travic CI](https://travis-ci.org/anmi/react-rich-text-template.svg?branch=master)](https://travis-ci.org/anmi/react-rich-text-template)

Text templates parameterized with react components

## Why?

Sometimes you need to insert components into strings comes from i18n module.

For example: "Hey, {username}, checkout your <profileLink>profile<profileLink>"

## Usage

```js
var rrtt = require('react-rich-text-template');

var template = rrtt.compile(
  "Hey, {username}, checkout your <profileLink>profile<profileLink>"
);

template({
  username: "anmi",
  profileLink: text => <profileLink>{text}</profileLink>
});
/*
["Hey, anmi, checkout your ", <profileLink>profile</profileLink>]
*/
```

You can redefine string wrapper and set key prop to speedup react elements merge
```jsx
var rrtt = require('react-rich-text-template');

var opts = Object.create(rrtt.defaultConfig);

opts.stringWrapper = (string, index) =>
  <span key={index}>{string}</span>

var template = rrtt.compile('template with<foo>multiple</foo>elems', opts)

template({
  foo: (children, index) =>
    <Foo key={index}>{children[0]}</Foo>
});
/* =>
[
  <span key=0>template with</span>,
  <Foo key=1>
    <span key=0>multiple</span>
  </Foo>
  <span key=2>elems</span>
]
*/
```

Define processMissingParam to handle missing params.
```jsx
var rrtt = require('react-rich-text-template');

var opts = Object.create(rrtt.defaultConfig);

opts.processMissingParam =
  function(paramName, children, index) {
    return <MissingTag>Missing tag: paramName</MissingTag>
  };

var template = rrtt.compile('Tag is <em>missing</em>');

template({});
/* =>
[
  'Tag is ',
  <MissingTag>Missing tag: em</MissingTag>
]
*/
```
