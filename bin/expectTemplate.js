
"use strict";

function ExpectTemplate(template, cb) {
  this.template = template;
  this.helpers = {};
  this.input = {};
  this.cb = cb;
}

ExpectTemplate.prototype = {
  withHelper: function withHelper(name, helper)  {
    this.helpers[name] = helper;
    return this;
  },
  withInput: function withInput(input) {
    this.input = input;
    return this;
  },
  toCompileTo: function toCompileTo(expected) {
    this.expected = expected;
    this.cb(this);
    return true;
  },
};

module.exports = ExpectTemplate;
