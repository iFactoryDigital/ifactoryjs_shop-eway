
// import local dependencies
const Model = require('model');

/**
 * create stripe class
 */
class Stripe extends Model {
  /**
   * construct item model
   *
   * @param attrs
   * @param options
   */
  constructor () {
    // run super
    super(...arguments);

    // bind methods
    this.sanitise = this.sanitise.bind(this);
  }

  /**
   * sanitises bot
   *
   * @return {Object}
   */
  async sanitise () {
    // return sanitised bot
    return {
      'id'    : this.get('_id') ? this.get('_id').toString() : false,
      'cards' : (this.get('cards') || []).map((card) => {
        // delete source
        delete card.source;

        // return card
        return card;
      })
    };
  }
}

/**
 * export stripe class
 *
 * @type {stripe}
 */
exports = module.exports = Stripe;
