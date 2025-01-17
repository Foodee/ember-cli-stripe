/* global StripeCheckout */
import Service from "@ember/service";
import { assign, merge } from "@ember/polyfills";
import { guidFor } from "@ember/object/internals";
import { isBlank, typeOf } from "@ember/utils";
import { getOwner } from "@ember/application";
import invokeAction from "../utils/invoke-action";
import stripeConfigOptions from "../utils/configuration-options";
import RSVP from "rsvp";

export default Service.extend({
  stripeConfig() {
    return Object.assign(
      {},
      getOwner(this).resolveRegistration("config:environment").stripe
    );
  },
  /*
   * Registers a component as the current target of this service.
   * When the first {{stripe-checkout}} component is registered we load
   * the StripeCheckout js lib.
   *
   * @public
   */
  registerComponent(component) {
    this._alive[guidFor(component)] = {
      component,
    };

    // Load StripeCheckout js lib
    this._loadStripeJs();
  },

  /**
   * Unregisters a component.
   *
   * @public
   */
  unregisterComponent(component) {
    delete this._alive[guidFor(component)];
  },

  /*
   * Open opens the StripeCheckout payment modal.
   *
   * @public
   */
  open(component) {
    this._stripeScriptPromise.then(() => {
      let config = this._stripeConfig(component);
      let stripeHandler = this._stripeHandler(component);
      stripeHandler.open(config);
    });
  },

  /*
   * Close closes the StripeCheckout payment modal.
   * @public
   */
  close(component) {
    let stripeHandler = this._stripeHandler(component);
    stripeHandler.close();
  },

  init() {
    this._super(...arguments);

    this._alive = {};
    this._scriptLoaded = false;
    this._scriptLoading = false;
  },

  /**
   * Looks for any Stripe config options on the component.
   */
  _componentStripeConfig(component) {
    let componentOptions = component.getProperties(stripeConfigOptions);
    return this._cleanupOptions(componentOptions);
  },

  /**
   * Stripe config options with env configs merged with the ones provided through
   * the component.
   */
  _stripeConfig(component) {
    let stripeConfig = this.stripeConfig() || {};
    let options = {};

    if (assign) {
      assign(options, stripeConfig, this._componentStripeConfig(component));
    } else {
      // Support for Ember <= 2.4 (when assign was introduced)
      merge(options, stripeConfig);
      merge(options, this._componentStripeConfig(component));
    }

    return this._cleanupOptions(options);
  },

  _stripeHandler(component) {
    let componentGuid = guidFor(component);
    if ("handler" in this._alive[componentGuid]) {
      return this._alive[componentGuid]["handler"];
    }

    let stripeConfig = this._stripeConfig(component);
    if (!("key" in stripeConfig)) {
      throw new Error("[ember-cli-stripe] Missing required `key` param");
    }

    let handler = StripeCheckout.configure({
      key: stripeConfig.key,
      token() {
        invokeAction(component, "onToken", ...arguments);

        // Add deprecation for previous `action` callback
        if (!isBlank(component.attrs.action)) {
          invokeAction(component, "action", ...arguments);
        }
      },
      opened() {
        invokeAction(component, "onOpened");
      },
      closed() {
        invokeAction(component, "onClosed");
      },
    });

    this._alive[componentGuid]["handler"] = handler;

    return handler;
  },

  _loadStripeJs() {
    if (this._scriptLoaded || this._scriptLoading) {
      return this._stripeScriptPromise;
    }

    this._scriptLoading = true;

    let script = document.createElement("script");
    script.src = "https://checkout.stripe.com/checkout.js";
    script.async = true;
    script.type = "text/javascript";

    this._stripeScriptPromise = new RSVP.Promise((resolve, reject) => {
      script.onload = () => {
        this._scriptLoaded = true;
        resolve();
        this.onScriptLoaded();
      };
      script.onerror = () => {
        this._invokeAction("onStripeLoadError", ...arguments);
        reject();
      };

      document.body.appendChild(script);
    });

    return this._stripeScriptPromise;
  },

  onScriptLoaded() {
  },

  onStripeLoadError() {
  },

  _cleanupOptions(options) {
    let cleanedOptions = {};
    for (let key in options) {
      if (typeOf(options[key]) !== "undefined") {
        cleanedOptions[key] = options[key];
      }
    }

    return cleanedOptions;
  },
});
