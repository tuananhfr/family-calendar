// Jest gives each test file a copied process.env, so assigning TZ there never reaches Node's tzset hook.
// This environment runs in the real process and exposes a setter that changes the actual zone.
const { TestEnvironment } = require('jest-environment-node');

class TimeZoneEnvironment extends TestEnvironment {
  constructor(config, context) {
    super(config, context);
    this.global.__setProcessTimeZone = (timeZone) => {
      if (timeZone === undefined) delete process.env.TZ;
      else process.env.TZ = timeZone;
    };
    this.global.__getProcessTimeZone = () => process.env.TZ;
  }
}

module.exports = TimeZoneEnvironment;
