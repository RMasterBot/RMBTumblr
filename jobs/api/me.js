/*
 me

 Usage:
   node job <bot_name> me (-a | --app) <app_name> (-u | --user) <user_name>

 API endpoint used:
   GET /me

 Scope:
   xxx
*/
/**
 * @param {Tumblr} bot
 * @param {string[]} extraArguments
 * @param {Job~Callback} callback
 */
module.exports = function(bot, extraArguments, callback) {
  bot.me(function (error, data) {
    if(error) {
      if(callback) {
        callback(error, null);
      }
      return;
    }

    if(callback) {
      callback(null, data);
    }
  });
};