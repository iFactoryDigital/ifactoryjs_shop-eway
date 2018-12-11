// Require dependencies
const uuid   = require('uuid');
const money  = require('money-math');
const stripe = require('stripe');

// Require local dependencies
const config = require('config');

// Require local class dependencies
const PaymentMethodController = require('payment/controllers/method');

// Require models
const Data    = model('stripe');
const Product = model('product');

// require helpers
const ProductHelper = helper('product');

/**
 * Create Stripe Controller class
 *
 * @extends PaymentMethodController
 */
class StripeController extends PaymentMethodController {

  /**
   * Construct Stripe Controller class
   */
  constructor () {
    // Run super
    super();

    // Set private variables
    this._stripe = stripe(config.get('stripe.secret'));

    // Bind private methods
    this._createSource = this._createSource.bind(this);

    // Bind super private methods
    this._pay    = this._pay.bind(this);
    this._method = this._method.bind(this);

    // On checkout init
    this.eden.pre('order.stripe',  this._paymentRequest);
    this.eden.pre('checkout.init', this._checkout);

    // Use middleware
    this.eden.router.use(this._middleware);

    // Hook view state
    this.eden.pre('view.compile', (render) => {
      // Set config
      render.config.stripe = config.get('stripe.client');
    });
  }

  /**
   * Checkout order
   *
   * @param  {Object} order
   */
  _checkout (order) {
    // Add action
    order.set('actions.stripe', {
      'type'     : 'stripe',
      'data'     : {},
      'priority' : 10
    });
  }

  /**
   * on shipping
   *
   * @param  {order}   Order
   * @param  {Object}  action
   *
   * @return {Promise}
   */
  async _paymentRequest (order, action, actions) {
    // set shipping
    let user    = await order.get('user');
    let invoice = await order.get('invoice');

    // check action value
    if (!action.value || !Object.keys(action.value).length) return;

    // check user
    if (user) {
      // lock user
      await user.lock();

      // set email
      user.set('name',  user.get('name')  || action.value.payerName);
      user.set('email', user.get('email') || action.value.payerEmail);

      // save user
      await user.save();

      // unlock user
      user.unlock();
    }

    // find payment action
    let paymentAction = actions.find((check) => check.type === 'payment');

    // set value
    paymentAction.value = {
      'type'    : 'stripe',
      'data'    : action.value.token,
      'request' : true
    };

    // set actions
    order.set('actions', actions);
  }

  /**
   * stripe middleware
   *
   * @param {req} req
   * @param {res} res
   * @param {Function} next
   */
  _middleware (req, res, next) {
    // set footer
    let ft = '<script src="//js.stripe.com/v3/"></script>';

    // set head
    res.locals.page.script = (res.locals.page.script || '') + ft;

    // run next
    next();
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
          'id'   : 'stipe.nouser',
          'text' : 'Invalid user'
        });

        // Return false
        return false;
      }

      const card = data && (data.get('cards') || []).find((card) => {
        // Return card id check
        return card.id = method.card.id;
      });

      // Check data
      if (!card) {
        // Set error
        payment.set('error', {
          'id'   : 'stipe.notfound',
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
      // Set customer
      const customer = data ? data.get('customer') : (await this._stripe.customers.create({
        'email' : user ? user.get('email') : 'anonymous'
      })).id;

      // Check data and save
      if (user && !data && method.save) {
        // Create new data
        data = new Data({
          'user'     : user,
          'customer' : customer
        });
      }

      // Set req
      const req = method.card;

      // Create card
      const card = await this._stripe.customers.createSource(customer, {
        'source' : {
          'cvc'       : req.cvc,
          'name'      : req.name,
          'number'    : req.number,
          'object'    : 'card',
          'exp_year'  : req.expiry.year,
          'exp_month' : req.expiry.month
        }
      });

      // Check save
      if (method.save && data) {
        // Set cards
        const cards = data.get('cards') || [];

        // Push new card to cards
        cards.push({
          'id'      : uuid(),
          'brand'   : card.brand.toLowerCase(),
          'last4'   : card.last4,
          'source'  : card.id,
          'funding' : card.funding,
          'country' : card.country
        });

        // Update data
        data.set('cards', cards);

        // Save data
        await data.save();
      }

      // Return source
      return {
        'source'   : card.id,
        'customer' : customer
      };
    } catch (e) {
      // Set error
      payment.set('error', {
        'id'   : 'stipe.error',
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

    // Load Stripe data for user
    const data = await Data.findOne({
      'user.id' : order.get('user.id')
    });

    // Add Stripe Payment Method
    action.data.methods.push({
      'type'     : 'stripe',
      'data'     : data ? await data.sanitise() : {},
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
    if (!await super._pay(payment) || payment.get('method.type') !== 'stripe') return;

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
        // let items
        let subscriptionItems = (await Promise.all(invoice.get('lines').map(async (line) => {
          // get product
          let product = await Product.findById(line.product);

          // get price
          let price = await ProductHelper.price(product, line.opts || {});

          // return value
          let amount = parseFloat(price.amount) * parseInt(line.qty || 1);

          // hook
          await this.eden.hook('line.price', {
            'qty'  : line.qty,
            'user' : await order.get('user'),
            'opts' : line.opts,

            order,
            price,
            amount,
            product
          });

          // return object
          return {
            'sku'      : product.get('sku') + (Object.values(line.opts || {})).join('_'),
            'name'     : product.get('title.en-us'),
            'type'     : product.get('type'),
            'price'    : money.floatToAmount(parseFloat(price.amount)),
            'amount'   : amount,
            'period'   : (line.opts || {}).period,
            'product'  : product.get('_id').toString(),
            'currency' : payment.get('currency') || config.get('shop.currency') || 'USD',
            'quantity' : parseInt(line.qty || 1)
          };
        }))).filter((item) => item.type === 'subscription');

        // remove from total
        let subscriptionTotal = parseFloat(subscriptionItems.reduce((accum, item) => {
          // add amount
          return money.add(accum, money.floatToAmount(parseFloat(item.price) * item.quantity));
        }, '0.00'));

        // remove amount
        realTotal -= subscriptionTotal;

        // set periods
        let periods = {
          'weekly' : {
            'interval'      : 'week',
            'interval_count' : 1
          },
          'monthly' : {
            'interval'       : 'month',
            'interval_count' : 1
          },
          'quarterly' : {
            'interval'       : 'month',
            'interval_count' : 3
          },
          'biannually' : {
            'interval'       : 'month',
            'interval_count' : 6
          },
          'annually' : {
            'interval'       : 'year',
            'interval_count' : 1
          }
        };

        // loop subscriptions
        await Promise.all(subscriptions.map(async (subscription) => {
          // find item
          let item = subscriptionItems.find((i) => i.product = subscription.get('product.id') && i.period === subscription.get('period'));

          // create plan
          let plan = await this._stripe.plans.create({
            'amount'   : zeroDecimal.indexOf(currency.toUpperCase()) > -1 ? parseInt(item.price) : parseInt(parseFloat(item.price) * 100),
            'product'  : {
              'name' : 'Subscription #' + subscription.get('_id').toString()
            },
            'interval'       : periods[item.period].interval,
            'currency'       : item.currency,
            'interval_count' : periods[item.period].interval_count
          });

          // set stripe
          subscription.set('plan', plan);
        }));

        // create actual subscription
        let charge = await this._stripe.subscriptions.create({
          'items' : subscriptions.map((subscription) => {
            return {
              'plan' : subscription.get('plan.id')
            };
          }),
          'customer' : source.customer
        });

        // loop subscriptions
        await Promise.all(subscriptions.map(async (subscription) => {
          // set paypal
          subscription.set('charge', charge);

          // save subscription
          await subscription.save();
        }));
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
        'amount'      : zeroDecimal.indexOf(currency.toUpperCase()) > -1 ? realTotal : (realTotal * 100),
        'currency'    : currency,
        'description' : 'Payment ID ' + payment.get('_id').toString()
      };

      // check data
      if (payment.get('method.request')) {
        // set source
        data.source = source;
      } else {
        // set card data
        data.source   = source.source;
        data.customer = source.customer;
      }

      // Create chargs
      const charge = await this._stripe.charges.create(data);

      // Set charge
      payment.set('data', {
        'charge' : charge
      });

      // Set complete
      payment.set('complete', true);
    } catch (e) {
      // Set error
      payment.set('error', {
        'id'   : 'stipe.error',
        'text' : e.toString()
      });

      // Set not complete
      payment.set('complete', false);
    }
  }

}

/**
 * Export Stripe Controller class
 *
 * @type {StripeController}
 */
exports = module.exports = StripeController;
