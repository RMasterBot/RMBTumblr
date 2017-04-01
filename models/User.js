/**
 * User Model
 * @class User
 * @param {User~Json} json json of the user
 * @constructor
 */
function User(json) {
  this.user = json.user;
}

/**
 * @return {User~Json|*}
 */
User.prototype.getJson = function() {
  return this.user;
};

/**
 * @return {string}
 */
User.prototype.getName = function() {
  return this.user.name;
};

module.exports = User;

/**
 * User Json
 * @typedef {Object} User~Json
 * @property {string} name
 */