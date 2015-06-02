# react-rich-text-template
[![Travic CI]https://travis-ci.org/anmi/react-rich-text-template.svg?branch=master](https://travis-ci.org/anmi/react-rich-text-template)

Text templates parameterized with react components

## Why?

Sometimes you need to insert components into strings comes from i18n module.

For example: "Hey, {username}, checkout your <profileLink>profile<profileLink>"

## Usage

```js
var rrtt = require('react-rich-text-template');

var template = rrtt.compile(
  rrtt.defaultConfig,
  "Hey, {username}, checkout your <profileLink>profile<profileLink>"
);

template({
  username: "anmi",
  profileLink: text => <profileLink>{text}</profileLink>
});
/*
["Hey, ", "anmi", ", checkout your ", <profileLink>profile</profileLink>]
*/
```
