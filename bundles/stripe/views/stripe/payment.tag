<stripe-payment>
  <a href="#!">
    <img src="/public/assets/images/vendor/stripe.svg" class="float-right stripe-logo" />
    <i class="fa fa-times text-danger mr-3" if={ !opts.order.invoice.paid } />
    <i class="fa fa-check text-success mr-3" if={ opts.order.invoice.paid } />
    { this.t ('stripe.order.' + (opts.order.invoice.paid ? 'paid' : 'pending')) }
  </a>

  <script>
    // do mixins
    this.mixin ('i18n');

  </script>
</stripe-payment>
