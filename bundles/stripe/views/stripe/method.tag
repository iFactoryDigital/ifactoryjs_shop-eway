<stripe-method>
  <a href="#!" onclick={ onSelect }>
    <div class="row">
      <div class="col-8 d-flex align-items-center">
        <div class="w-100">
          <div class="custom-control custom-radio p-0">
            <input name="payment-method-{ Math.random() }" value="stripe" type="radio" class="custom-control-input" checked={ this.selected && (!Object.keys(opts.val).length || opts.val.type === 'stripe') }>
            <label class="custom-control-label pl-2">{ this.t('stripe.method') }</label>
          </div>
        </div>
      </div>
      <div class="col-4 text-right">
        <img src="/public/assets/images/vendor/stripe.svg" class="stripe-logo" />
      </div>
    </div>
  </a>
  <div if={ this.selected && (!Object.keys(opts.val).length || opts.val.type === 'stripe') } class="w-100 px-3">
    <div class="row row-eq-height row-cards pt-3 mb-3" if={ ((opts.method.data || {}).cards || []).length }>
      <div class="col-6 col-md-4 pb-3" each={ card, i in ((opts.method.data || {}).cards || []) }>
        <div class={ 'card card-stripe h-100' : true, 'active' : isCard(card) }>
          <a href="#!" class="card-body" onclick={ onCard }>
            <h2 class="text-right">
              <i class="fab fa-cc-{ card.brand }" />
            </h2>
            <p class="card-text text-center mt-3">
              XXXX XXXX XXXX { card.last4 }
            </p>
          </a>
        </div>
      </div>
    </div>
    <div class="form-group">
      <label for="cardNumber">Card Name</label>
      <input type="text" ref="name" class="form-control" name="name" placeholder="Name on card" autocomplete="cc-name" required autofocus onchange={ onChange } />
    </div>
    <div class="form-group">
      <label for="cardNumber">Card Number</label>
      <div class="input-group">
        <input class="form-control" name="number" ref="number" placeholder="Valid Card Number" autocomplete="cc-number" required autofocus onchange={ onChange } />
        <div class="input-group-append">
          <span class="input-group-text">
            <i class="fa fa-credit-card" />
          </span>
        </div>
      </div>
    </div>
    <div class="row">
      <div class="col-7">
        <div class="form-group">
          <label for="cardExpiry">
            <span class="d-md-inline d-none">Expiration</span>
            <span class="d-md-none">Exp</span>
            Date
          </label>
          <div class="row">
            <div class="col-6">
              <input class="form-control" ref="month" name="expiry[month]" placeholder="MM" autocomplete="cc-exp-month" required onchange={ onChange } />
            </div>
            <div class="col-6">
              <input class="form-control" ref="year" name="expiry[year]" placeholder="YY" autocomplete="cc-exp-year" required onchange={ onChange } />
            </div>
          </div>
        </div>
      </div>
      <div class="col-5">
        <div class="form-group">
          <label for="csc">Security Code Code</label>
          <input id="csc" class="form-control" ref="csc" name="csc" placeholder="CSC" autocomplete="cc-csc" required onchange={ onChange } />
        </div>
      </div>
    </div>
    <p class="payment-errors"></p>
    <div class="custom-control custom-radio" onclick={ onChange }>
      <input type="checkbox" name="payment[save]" class="custom-control-input" id="payment-save" ref="save" checked onchange={ onChange }>
      <label class="custom-control-label pl-2" for="payment-save">Save Card</label>
    </div>
    <p class="mb-3" />
  </div>

  <script>
    // do mixins
    this.mixin ('i18n');

    // set values
    this.loading  = false;
    this.selected = false;

    /**
     * on method function
     *
     * @param  {Event} e
     */
    onCard (e) {
      // prevent default
      e.preventDefault ();

      // set card
      opts.method.data.card = e.item.card;

      // on ready
      opts.onReady (opts.method);
    }

    /**
     * select card
     *
     * @param  {Event} e
     */
    onSelect (e) {
      // check method
      if (!opts.method.data.card) {
        opts.onReady (null);
      } else {
        opts.onReady (opts.method);
      }

      // select
      this.selected = true;

      // update view
      this.update ();
    }

    /**
     * on save function
     *
     * @param  {Event} e
     */
    onChange (e) {
      // return false on details
      if (['csc', 'name', 'number', 'year', 'month'].find ((test) => !jQuery (this.refs[test]).val ().length)) {
        return console.log ('here');
      }

      // get name and address
      let save = jQuery (this.refs.save).is (':checked');
      let card = {
        'csc'  : this.refs.csc.value,
        'name' : this.refs.name.value,
        'number' : this.refs.number.value,
        'expiry' : {
          'year'  : this.refs.year.value,
          'month' : this.refs.month.value
        }
      };

      // select
      this.selected = true;

      // set value
      opts.method.data = { save, card };

      // on ready
      opts.onReady (opts.method);
    }

    /**
     * returns true if card
     *
     * @param  {Object}  card
     *
     * @return {Boolean}
     */
    isCard (card) {
      // check card
      return card.id === ((opts.method.data || {}).card || {}).id;
    }

  </script>
</stripe-method>
