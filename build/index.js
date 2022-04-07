"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _pluginRetry = require("@octokit/plugin-retry");

var _pluginThrottling = require("@octokit/plugin-throttling");

var _rest = require("@octokit/rest");

var _bluebird = _interopRequireDefault(require("bluebird"));

var _fs = _interopRequireDefault(require("fs"));

var _ghostStorageBase = _interopRequireDefault(require("ghost-storage-base"));

var _isUrl = _interopRequireDefault(require("is-url"));

var _path = _interopRequireDefault(require("path"));

var _sharp = _interopRequireDefault(require("sharp"));

var _url = require("url");

var utils = _interopRequireWildcard(require("./utils"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const ExtendedOctokit = _rest.Octokit.plugin(_pluginRetry.retry, _pluginThrottling.throttling);

const readFile = _bluebird.default.promisify(_fs.default.readFile);

const RAW_GITHUB_URL = 'https://raw.githubusercontent.com';

class GitHubStorage extends _ghostStorageBase.default {
  constructor(config) {
    super();
    const {
      branch,
      destination,
      owner,
      repo
    } = config; // Required config

    const token = process.env.GHOST_GITHUB_TOKEN || config.token;
    this.owner = process.env.GHOST_GITHUB_OWNER || owner;
    this.repo = process.env.GHOST_GITHUB_REPO || repo;
    this.branch = process.env.GHOST_GITHUB_BRANCH || branch || 'master'; // Optional config

    const baseUrl = utils.removeTrailingSlashes(process.env.GHOST_GITHUB_BASE_URL || config.baseUrl || '');
    this.baseUrl = (0, _isUrl.default)(baseUrl) ? baseUrl : `${RAW_GITHUB_URL}/${this.owner}/${this.repo}/${this.branch}`;
    this.destination = process.env.GHOST_GITHUB_DESTINATION || destination || '/';
    this.useRelativeUrls = process.env.GHOST_GITHUB_USE_RELATIVE_URLS === 'true' || config.useRelativeUrls || false;
    this.client = new ExtendedOctokit({
      auth: token,
      throttle: {
        onRateLimit: (retryAfter, options) => {
          console.warn(`Request quota exhausted for request ${options.method} ${options.url}`);

          if (options.request.retryCount < 3) {
            // Retry 3 times
            return true;
          }
        },
        onAbuseLimit: (retryAfter, options) => {
          console.warn(`Abuse detected for request ${options.method} ${options.url}`);
        }
      }
    });
  }

  delete() {
    return _bluebird.default.reject('Not implemented');
  }

  exists(filename, targetDir) {
    const dir = targetDir || this.getTargetDir();
    const filepath = this.getFilepath(_path.default.join(dir, filename));
    return this.client.repos.getContent({
      method: 'HEAD',
      owner: this.owner,
      repo: this.repo,
      ref: this.branch,
      path: filepath
    }).then(res => true).catch(e => {
      if (e.status === 404) {
        return false;
      } // Just rethrow. This way, no assumptions are made about the file's status.


      throw e;
    });
  }

  read(options) {
    // NOTE: Implemented to address https://github.com/ifvictr/ghost-storage-github/issues/22
    return new _bluebird.default((resolve, reject) => {
      const req = utils.getProtocolAdapter(options.path).get(options.path, res => {
        const data = [];
        res.on('data', chunk => {
          data.push(chunk);
        });
        res.on('end', () => {
          resolve(Buffer.concat(data));
        });
      });
      req.on('error', reject);
    });
  }

  save(file, targetDir) {
    const dir = targetDir || this.getTargetDir();
    console.log(file);
    return _bluebird.default.all([this.getUniqueFileName(file, dir), file.size >= 500 * 1024 ? (0, _sharp.default)(file.path).resize({
      width: 1200,
      height: 1200,
      fit: 'inside'
    }).withMetadata().toBuffer() : readFile(file.path)]).then(([filename, data]) => {
      return this.client.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        branch: this.branch,
        message: `Create ${filename}`,
        path: this.getFilepath(filename),
        content: data.toString('base64') // GitHub API requires content to use base64 encoding

      });
    }).then(res => {
      const {
        path
      } = res.data.content;

      if (this.useRelativeUrls) {
        return `/${path}`;
      }

      return this.getUrl(path);
    }).catch(e => {// Stop failed attempts from preventing retries
    });
  }

  serve() {
    // No need to serve because absolute URLs are returned
    return (req, res, next) => {
      next();
    };
  }

  getUrl(filepath) {
    const url = new _url.URL(this.baseUrl);
    url.pathname = `${utils.removeTrailingSlashes(url.pathname)}/${filepath}`;
    return url.toString();
  }

  getFilepath(filename) {
    return utils.removeLeadingSlashes(_path.default.join(this.destination, filename));
  }

}

var _default = GitHubStorage;
exports.default = _default;
module.exports = exports.default;