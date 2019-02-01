
// Require dependencies
const eway  = require('eway-rapid');
const uuid  = require('uuid');
const money = require('money-math');

// Require local dependencies
const config = require('config');

// Require local class dependencies
const PaymentMethodController = require('payment/controllers/method');

// Require models
const Data    = model('eway');
const Product = model('product');

// require helpers
const ProductHelper = helper('product');

/**
 * Create Eway Controller class
 *
 * @extends PaymentMethodController
 */
class EwayController extends PaymentMethodController {

  /**
   * Construct Eway Controller class
   */
  constructor () {
    // Run super
    super();

    // Set private variables
    this._eway = eway.createClient(config.get('eway.key'), config.get('eway.password'), config.get('eway.endpoint'));

    // Bind private methods
    this._createSource = this._createSource.bind(this);

    // Bind super private methods
    this._pay    = this._pay.bind(this);
    this._method = this._method.bind(this);

    // Hook view state
    this.eden.pre('view.compile', (render) => {
      // Set config
      render.config.eway = config.get('eway.client');
    });
  }

  /**
   * Create source based on a given payment
   *
   * @param  {Payment} payment
   *
   * @return {Promise<Data|boolean>}
   *
   * @private
   */
  async _createSource (payment) {
    // Set method
    const method = payment.get('method.data');

    // Set user
    const user = await payment.get('user');

    // Set data
    let data = user && await Data.findOne({
      'user.id' : user.get('_id').toString()
    });

    // Check card id
    if (method.card.id) {
      // Check user
      if (!user) {
        // Set error
        payment.set('error', {
          'id'   : 'eway.nouser',
          'text' : 'Invalid user'
        });

        // Return false
        return false;
      }

      // find card
      const card = data && (data.get('cards') || []).find((card) => {
        // Return card id check
        return card.id = method.card.id;
      });

      // Check data
      if (!card) {
        // Set error
        payment.set('error', {
          'id'   : 'eway.notfound',
          'text' : 'Credit card not found'
        });

        // Return false
        return false;
      }

      // Return source
      return {
        'source'   : card.source,
        'customer' : data.get('customer')
      };
    }

    // Try/catch
    try {
      // Set req
      const req = method.card;

      // Set customer
      const card = (await this._eway.createCustomer(eway.Enum.Method.DIRECT, {
         'Title'       : 'Mr.',
         'Country'     : 'au',
         'LastName'    : req.name.split(' ')[1],
         'FirstName'   : req.name.split(' ')[0],
         'CardDetails' : {
           'CVN'         : req.cvc,
           'Name'        : req.name,
           'Number'      : req.number,
           'ExpiryYear'  : req.expiry.year,
           'ExpiryMonth' : req.expiry.month
         }
      })).attributes;

      // Check data and save
      if (user && !data && method.save) {
        // Create new data
        data = new Data({
          'user' : user
        });
      }

      // Check save
      if (method.save && data) {
        // Set cards
        const cards = data.get('cards') || [];

        // Push new card to cards
        cards.push(card);

        // Update data
        data.set('cards', cards);

        // Save data
        await data.save();
      }

      // Return source
      return {
        'source' : card.Customer.TokenCustomerID
      };
    } catch (e) {
      // Set error
      payment.set('error', {
        'id'   : 'eway.error',
        'text' : e.toString()
      });

      // Return false
      return false;
    }
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
  async _method (order, action) {
    // Check super
    if (!await super._method(order, action)) return;

    // Load Eway data for user
    const data = await Data.findOne({
      'user.id' : order.get('user.id')
    });

    // Add Eway Payment Method
    action.data.methods.push({
      'type'     : 'eway',
      'data'     : data ? await data.sanitise() : {},
      'public'   : config.get('eway.client'),
      'priority' : 0
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
    if (!await super._pay(payment) || payment.get('method.type') !== 'eway') return;

    // set source
    let source = null;

    // check if normal payment request api
    if (payment.get('method.request')) {
      // is payment request api
      source = payment.get('method.data.id');
    } else {
      // Set source
      source = await this._createSource(payment);
    }

    // Check source
    if (!source) return;

    // get invoice details
    let invoice       = await payment.get('invoice');
    let order         = await invoice.get('order');
    let subscriptions = await order.get('subscriptions');

    // Get currency
    const currency = payment.get('currency').toLowerCase() || 'usd';

    // Get zero decimal
    const zeroDecimal = ['MGA', 'BIF', 'PYGI', 'XAF', 'XPF', 'CLP', 'KMF', 'RWF', 'DJF', 'KRW', 'GNF', 'JPY', 'VUV', 'VND', 'XOF'];

    // Run try/catch
    try {
      // get real total
      let realTotal = payment.get('amount');

      // get subscriptions
      if (subscriptions && subscriptions.length) {

      }

      // check amount
      if (!realTotal || realTotal < 0) {
        // Set complete
        payment.set('complete', true);

        // return
        return;
      }

      // create data
      const data = {
        'Payment' : {
          'TotalAmount'        : zeroDecimal.indexOf(currency.toUpperCase()) > -1 ? realTotal : (realTotal * 100),
          'CurrencyCode'       : currency,
          'InvoiceReference'   : order.get('_id').toString(),
          'InvoiceDescription' : 'Payment ID ' + payment.get('_id').toString(),
        },
        'Customer': {
          'TokenCustomerID' : source.source
        },
        'TransactionType' : 'MOTO'
      };

      // Create chargs
      const charge = await this._eway.createTransaction(eway.Enum.Method.DIRECT, data);

      // check errors
      if (charge.attributes.Errors) {
        // set error
        return payment.set('error', {
          'id'   : 'eway.' + charge.attributes.Errors.split(',')[0],
          'text' : 'Eway error code(s): ' + charge.attributes.Errors
        })
      }

      // Set charge
      payment.set('data', {
        'charge' : charge
      });

      // Set complete
      payment.set('complete', true);
    } catch (e) {
      // Set error
      payment.set('error', {
        'id'   : 'eway.error',
        'text' : e.toString()
      });

      // Set not complete
      payment.set('complete', false);
    }
  }

}

/**
 * Export Eway Controller class
 *
 * @type {EwayController}
 */
exports = module.exports = EwayController;
