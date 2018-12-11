// Require dependencies
const stripe = require('stripe');

// Require local dependencies
const config = require('config');

// Require local class dependencies
const PaymentMethodController = require('payment/controllers/method');

// Require models
const Payment = model('payment');

/**
 * Create Alipay Controller class
 *
 * @mount /alipay
 *
 * @extends PaymentMethodController
 */
class AlipayController extends PaymentMethodController {

  /**
   * Construct Alipay Controller class
   */
  constructor () {
    // Run super
    super();

    // Set private variables
    this._stripe = stripe(config.get('stripe.secret'));

    // Bind public methods
    this.processAction = this.processAction.bind(this);

    // Bind private methods
    this._pay    = this._pay.bind(this);
    this._method = this._method.bind(this);
  }

  /**
   * Process action
   *
   * @route  {get} /process
   *
   * @param  {Request}  req
   * @param  {Response} res
   *
   * @return {Promise}
   */
  async processAction (req, res) {
    // Set source id
    const sourceID = req.query.source;

    // Set payment
    const payment = await Payment.findOne({
      'alipay.id'   : sourceID,
      'method.type' : 'alipay'
    });

    // Check payment
    if (!payment) return res.redirect('/checkout');

    // Lock payment
    await payment.lock();

    // Set order
    const order = await (await payment.get('invoice')).get('order');

    // Check complete
    if (!payment.get('complete')) {
      // Get currency
      const currency = payment.get('currency').toLowerCase() || 'usd';

      // Get zero decimal
      const zeroDecimal = ['MGA', 'BIF', 'PYGI', 'XAF', 'XPF', 'CLP', 'KMF', 'RWF', 'DJF', 'KRW', 'GNF', 'JPY', 'VUV', 'VND', 'XOF'];

      // Run try/catch
      try {
        // Create charge
        const charge = await this._stripe.charges.create({
          'amount'      : zeroDecimal.indexOf(currency.toUpperCase()) > -1 ? payment.get('amount') : (payment.get('amount') * 100),
          'currency'    : currency,
          'source'      : sourceID,
          'description' : 'Payment ID ' + payment.get('_id').toString()
        });

        // Set charge
        payment.set('data', {
          'charge' : charge
        });
        payment.set('complete', true);
      } catch (e) {
        // Set payment error
        payment.set('error', {
          'id'   : 'alipay',
          'text' : e.toString()
        });
      }

      // Save payment
      await payment.save();

      // Remove order redirect
      order.set('redirect', null);

      // Save order
      await order.save();
    }

    // Unlock payment
    await payment.unlock();

    // Redirect to order page
    res.redirect(`/order/${order.get('_id').toString()}`);
  }

  /**
   * Add Payment Method to list
   *
   * @param {Object} order
   * @param {Object} action
   *
   * @async
   * @private
   */
  async __method (order, action) {
    // Check super
    if (!await super.__method(order, action)) return;

    // Add Alipay Payment Method
    action.data.methods.push({
      'type'     : 'alipay',
      'data'     : {},
      'priority' : 3
    });
  }

  /**
   * Pay using Payment Method
   *
   * @param {Payment} payment
   *
   * @async
   * @private
   */
  async _pay (payment) {
    // Check super
    if (!await super._pay(payment) || payment.get('method.type') !== 'alipay') return;

    // Get currency
    const currency = payment.get('currency').toLowerCase() || 'usd';

    // Get zero decimal
    const zeroDecimal = ['MGA', 'BIF', 'PYGI', 'XAF', 'XPF', 'CLP', 'KMF', 'RWF', 'DJF', 'KRW', 'GNF', 'JPY', 'VUV', 'VND', 'XOF'];

    // Run try/catch
    try {
      // Create source
      const source = await this._stripe.sources.create({
        'type'     : 'alipay',
        'amount'   : zeroDecimal.indexOf(currency.toUpperCase()) > -1 ? payment.get('amount') : (payment.get('amount') * 100),
        'currency' : currency,
        'redirect' : {
          'return_url' : `https://${config.get('domain')}/alipay/process`
        }
      });

      // Check source
      if (source.hasOwnProperty('redirect') && source.redirect.hasOwnProperty('url')) {
        // Update payment
        payment.set('alipay', {
          'id' : source.id
        });

        payment.set('data', {
          'source' : source
        });

        payment.set('redirect', source.redirect.url);
      } else {
        // Set payment error
        payment.set('error', {
          'id'   : 'alipay.nourl',
          'text' : 'No redirect URI present'
        });
      }
    } catch (e) {
      // Set payment error
      payment.set('error', {
        'id'   : 'alipay',
        'text' : e.toString()
      });
    }

    payment.set('complete', false);
  }

}

/**
 * Export Alipay Controller class
 *
 * @type {AlipayController}
 */
exports = module.exports = AlipayController;
