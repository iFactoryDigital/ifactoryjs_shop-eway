<alipay-method>
  <a href="#!" onclick={ onMethod }>
    <div class="custom-control custom-radio">
      <input name="payment-method-{ Math.random () }" value="alipay" type="radio" class="custom-control-input" checked={ opts.val.type === opts.method.type }>

      <label class="custom-control-label pl-2">{ this.t ('alipay.method') }</label>
    </div>

    <img src="/public/assets/images/vendor/alipay.svg" class="float-right" />
  </a>

  <script>
    // do mixins
    this.mixin ('i18n');

    /**
     * on method function
     *
     * @param  {Event} e
     */
    onMethod (e) {
      // prevent default
      e.preventDefault ();

      // on ready
      opts.onReady (opts.method);
    }
  </script>
</alipay-method>
