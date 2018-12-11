<alipay-payment>
  <a href="#!">
    <i class="fa fa-times text-danger mr-3" if={ !opts.order.invoice.paid } />
    <i class="fa fa-check text-success mr-3" if={ opts.order.invoice.paid } />

    { this.t ('alipay.order.' + (opts.order.invoice.paid ? 'paid' : 'pending')) }

    <img src="/public/assets/images/vendor/alipay.svg" class="float-right" />
  </a>

  <div class="card-body" if={ !opts.order.invoice.paid }>
    <a href={ opts.order.redirect } class="btn btn-success">
      { this.t ('alipay.order.redirect') }
    </a>
  </div>

  <script>
    // do mixins
    this.mixin ('i18n');
  </script>
</alipay-payment>
