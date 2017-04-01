var Bot = require(require('path').join('..','..','core','bot.js'));

/**
 * Tumblr Bot
 * @class Tumblr
 * @augments Bot
 * @param {string} name
 * @param {string} folder
 * @param {Tumblr~Configuration[]} allConfigurations
 * @constructor
 */
function Tumblr(name, folder, allConfigurations){
  Bot.call(this, name, folder, allConfigurations);

  this.defaultValues.hostname = 'api.tumblr.com';
  
  this.defaultValues.httpModule = 'https';
  this.defaultValues.pathPrefix = '/v2/';
  this.defaultValues.port = 443;
  
  this.defaultValues.defaultRemainingRequest = 5000;
  this.defaultValues.defaultRemainingTime = 60*3600*24;
  
  this.tempTokenSecret = {};
}

Tumblr.prototype = new Bot();
Tumblr.prototype.constructor = Tumblr;

function generateString() {
  var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var length = 32;
  var result = '';

  for (; length > 0; --length) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }

  return result;
}

/**
 * Add oauth to headers parameters
 * @param {Bot~doRequestParameters} parameters
 */
Tumblr.prototype.generateOauth = function(parameters) {
  if(parameters.headers === undefined) {
    parameters.headers = {};
  }

  var params = [];
  var extraParams = [];

  var signedRequest;
  var signedKeyRequest;
  var signatureRequest;
  var url = encodeURIComponent(
    'https://' +
    ( (typeof parameters.hostname === 'string') ? parameters.hostname : this.defaultValues.hostname ) +
    ( (typeof parameters.pathPrefix === 'string') ? parameters.pathPrefix : this.defaultValues.pathPrefix) +
    ( (typeof parameters.path === 'string') ? parameters.path : this.defaultValues.path)
  );
  var method = parameters.method || this.defaultValues.method;

  params.push('oauth_callback="' + encodeURIComponent(this.currentConfiguration.callback_uri) + '"');
  params.push('oauth_consumer_key="' + this.currentConfiguration.consumer_key + '"');
  params.push('oauth_nonce="' + generateString() + '"');
  params.push('oauth_signature_method="HMAC-SHA1"');
  params.push('oauth_timestamp="' + Math.round(new Date().getTime() / 1000) + '"');
  if(this.accessToken.access_token) {
    params.push('oauth_token="' + this.accessToken.access_token + '"');
  }
  else if(this.currentConfiguration.access_token) {
    params.push('oauth_token="' + this.currentConfiguration.access_token + '"');
  }
  else if(parameters.options && parameters.options.accessToken) {
    params.push('oauth_token="' + parameters.options.accessToken + '"');
  }
  if(parameters.options && parameters.options.oauthParams) {
    params = params.concat(parameters.options.oauthParams);
  }
  params.push('oauth_version="1.0"');

  for(var k in parameters.get) {
    if (parameters.get.hasOwnProperty(k)) {
      extraParams.push(k + '="' + parameters.get[k] + '"');
    }
  }

  signedRequest = method  + '&' + url + '&' + encodeURIComponent(params.join('&').replace(/"/g,''))
    + encodeURIComponent( (extraParams.length > 0 ? '&' : '') + extraParams.join('&').replace(/"/g,''));
  signedKeyRequest = this.currentConfiguration.consumer_secret + '&'
    + ( (parameters.options && parameters.options.accessTokenSecret) || (parameters.options && parameters.options.accessToken) || this.accessToken.access_token_secret || this.currentConfiguration.access_token_secret || '');
  signatureRequest = require('crypto').createHmac('sha1', signedKeyRequest).update(signedRequest).digest('base64');

  params.push('oauth_signature="'+encodeURIComponent(signatureRequest)+'"');

  parameters.headers['Authorization'] = 'OAuth ' + params.join(',');
};

/**
 * Prepare and complete parameters for request
 * @param {Bot~doRequestParameters} parameters
 * @param {Bot~requestCallback|*} callback
 */
Tumblr.prototype.prepareRequest = function(parameters, callback) {
  this.generateOauth(parameters);

  if(parameters.options && parameters.options.useRequest === true) {
    this.request(parameters, callback);
  }
  else {
    this.doRequest(parameters, callback);
  }
};

/**
 * API me
 * @param {Tumblr~requestCallback} callback
 */
Tumblr.prototype.me = function(callback) {
  var params = {
    method: 'GET',
    path: 'user/info',
    output: {
      model: 'User'
    }
  };

  this.prepareRequest(params, callback);
};


/**
 * Add access token to query parameters
 * @param {Bot~doRequestParameters} parameters
 */
Tumblr.prototype.addQueryAccessToken = function(parameters) {
  if(parameters.get === undefined) {
    parameters.get = {};
  }

  parameters.get.access_token = this.accessToken.access_token;
};

/**
 * Get remaining requests from result 
 * @param {Request~Response} resultFromRequest
 * @return {Number}
 */
Tumblr.prototype.getRemainingRequestsFromResult = function(resultFromRequest) {
  var hour = resultFromRequest.headers['x-ratelimit-perhour-remaining'] >> 0;
  var day = resultFromRequest.headers['x-ratelimit-perday-remaining'] >> 0;

  return Math.min(hour, day);
};

/**
 * Get url for Access Token when you have to authorize an application
 * @param {string} scopes
 * @param {*} callback
 */
Tumblr.prototype.getAccessTokenUrl = function(scopes, callback) {
  var that = this;
  var params = {
    method:'POST',
    hostname:'www.tumblr.com',
    pathPrefix:'',
    path: '/oauth/request_token',
    options: {
      useRequest : true
    }
  };

  this.prepareRequest(params, function(error, data){
    if(error) {
      console.log(error);
      return;
    }

    var oauth = require('querystring').parse(data.data);
    that.tempTokenSecret[oauth.oauth_token] = oauth.oauth_token_secret;

    callback('https://www.tumblr.com/oauth/authorize?oauth_token=' + oauth.oauth_token);
  });
};

/**
 * Extract response in data for Access Token
 * @param {Object} req request from local node server
 * @return {*} code or something from response
 */
Tumblr.prototype.extractResponseDataForAccessToken = function(req) {
  var query = require('url').parse(req.url, true).query;

  if(Object.keys(query).length === 0) {
    return null;
  }

  return query;
};

/**
 * Request Access Token after getting code
 * @param {Object} oauth
 * @param {Bot~requestAccessTokenCallback} callback
 */
Tumblr.prototype.requestAccessToken = function(oauth, callback) {
  var that = this;
  var params = {
    method:'POST',
    hostname:'www.tumblr.com',
    pathPrefix:'',
    path: '/oauth/access_token',
    headers:{
      'Content-Type' : 'application/x-www-form-urlencoded'
    },
    options: {
      oauthParams : ['oauth_verifier="'+oauth.oauth_verifier+'"'],
      accessToken : oauth.oauth_token,
      accessTokenSecret : this.tempTokenSecret[oauth.oauth_token],
      useRequest : true
    }
  };

  this.prepareRequest(params, function(error, data){
    that.tempTokenSecret[oauth.oauth_token] = null;
    if(error) {
      console.log(error);
      return;
    }

    callback(error, data.data);
  });
};

Tumblr.prototype.formatNewAccessToken = function(accessTokenData, scopes, callback) {
  var that = this;
  var oauth = require('querystring').parse(accessTokenData);

  var formatAccessToken = {
    "access_token": oauth.oauth_token,
    "access_token_secret": oauth.oauth_token_secret,
    "user": null
  };

  that.getUserForNewAccessToken(formatAccessToken, function(err, user){
    if(err) {
      callback(err, null);
    }
    else {
      formatAccessToken.user = user;
      callback(null, formatAccessToken);
    }
  });
};

Tumblr.prototype.getUserForNewAccessToken = function(formatAccessToken, callback) {
  var that = this;

  that.setAccessToken(formatAccessToken);
  that.verifyAccessTokenScopesBeforeCall = false;
  this.me(function(err, user){
    that.verifyAccessTokenScopesBeforeCall = true;
    if(err) {
      callback(err, null);
    }
    else {
      var username = (user !== null) ? user.getName() : null;
      callback(null, username);
    }
  });
};

Tumblr.prototype.extractDataFromRequest = function(data) {
  return data.response;
};

module.exports = Tumblr;

/**
 * Tumblr Configuration
 * @typedef {Object} Tumblr~Configuration
 * @property {string} name
 * @property {string} consumer_key
 * @property {string} consumer_secret
 * @property {string} access_token
 * @property {string} callback_uri
 * @property {string} scopes
 */
/**
 * Request callback
 * @callback Tumblr~requestCallback
 * @param {Error|string|null} error - Error
 * @param {*} data
 */
