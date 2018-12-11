<stripe-checkout>
  <div class="pay-now" ref="button">

  </div>
  <div if={ this.can } class="mb-4 mt-4 text-center">
    <h3 class="text-muted m-0">
      - OR -
    </h3>
  </div>

  <script>
    // do mixins
    this.mixin('i18n');
    this.mixin('user');
    this.mixin('config');

    // set variables
    this.loading = false;

    /**
     * on remove removes code
     */
    this.on ('mount', async () => {
      // set validate to value
      if (!opts.action.value) opts.action.value = {};

      // check frontend
      if (!this.eden.frontend) return;

      // build stripe
      this.stripe  = Stripe(this.config.stripe);
      this.request = this.stripe.paymentRequest({
        'country'  : 'US',
        'currency' : 'usd',
        'total' : {
          'label'  : 'GM8 order',
          'amount' : (await opts.checkout.total() * 100),
        },
        'requestPayerName'  : true,
        'requestPayerEmail' : true,
      });

      // create elements
      const elements = this.stripe.elements();
      const prButton = elements.create('paymentRequestButton', {
        'paymentRequest' : this.request
      });

      // await can make payment
      const result = await this.request.canMakePayment();

      // check result
      if (result) {
        // set can
        this.can = true;

        // update view
        this.update();

        // mount stripe button
        prButton.mount(this.refs.button);

        // on token
        this.request.on('token', (ev) => {
          // submit checkout
          opts.action.value = Object.assign({}, ev);

          // remove complete
          delete opts.action.value.complete;

          // submit
          let order = opts.checkout.submit();

          // check paid
          if ((order.invoice || {}).paid) {
            // complete success
            ev.complete('success');
          } else {
            ev.complete('fail');
          }
        });
      }
    });

  </script>
</stripe-checkout>
