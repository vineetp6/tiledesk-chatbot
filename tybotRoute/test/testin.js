var assert = require('assert');

describe('Conversation1 - Form filling', async () => {

  it('/start', (done) => {
    // await unlockIntent( () => {
      done();
    // });
  });

});

async function unlockIntent(tdcache, requestId) {
  await this.tdcache.del("tilebot:requests:"  + requestId + ":locked");
  // await this.tdcache.del("tilebot:requests:"  + requestId + ":locked");
  // console.log("unlocked.")
}

function pippo(callback) {
  setTimeout(() => {
    this.test();
    callback()
  }, 1000);
}