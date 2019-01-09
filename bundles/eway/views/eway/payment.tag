<eway-payment>
  <a href="#!">
    <img src="/public/assets/images/vendor/eway.svg" class="float-right eway-logo" />
    <i class="fa fa-times text-danger mr-3" if={ !opts.order.invoice.paid } />
    <i class="fa fa-check text-success mr-3" if={ opts.order.invoice.paid } />
    { this.t('eway.order.' + (opts.order.invoice.paid ? 'paid' : 'pending')) }
  </a>

  <script>
    // do mixins
    this.mixin('i18n');

  </script>
</eway-payment>
