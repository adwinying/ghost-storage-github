"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.removeTrailingSlashes = exports.removeLeadingSlashes = exports.getProtocolAdapter = void 0;

var _http = _interopRequireDefault(require("http"));

var _https = _interopRequireDefault(require("https"));

var _url = require("url");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const adapters = {
  'http:': _http.default,
  'https:': _https.default
};

const getProtocolAdapter = inputUrl => {
  const url = new _url.URL(inputUrl);
  return adapters[url.protocol];
};

exports.getProtocolAdapter = getProtocolAdapter;

const removeLeadingSlashes = str => str.replace(/^\/+/, '');

exports.removeLeadingSlashes = removeLeadingSlashes;

const removeTrailingSlashes = str => str.replace(/\/+$/, '');

exports.removeTrailingSlashes = removeTrailingSlashes;