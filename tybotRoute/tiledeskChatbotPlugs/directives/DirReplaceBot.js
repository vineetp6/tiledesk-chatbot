
class DirReplaceBot {

  constructor(config) {
    if (!config.tdclient) {
      throw new Error('tdclient (TiledeskClient) object is mandatory.');
    }
    this.tdclient = config.tdclient;
    this.requestId = config.requestId;
  }

  execute(directive, callback) {
    console.log("Replacing bot")
    let action;
    if (directive.action) {
      action = directive.action;
    }
    else if (directive.parameter) {
      let botName = directive.parameter.trim();
      action = {
        body: {
          botName: botName
        }
      }
    }
    else {
      callback();
    }
    this.go(action, () => {
      callback();
    })
  }

  go(action, callback) {
    this.tdclient.replaceBotByName(this.requestId, action.body.botName, () => {
      callback();
    });
  }
}

module.exports = { DirReplaceBot };