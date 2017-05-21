import config from '../config/environment';

export function initialize() {
  const application = arguments[1] || arguments[0];
  const { stripe = {} } = config;

  application.register('config:stripe', stripe, { instantiate: false });
  application.inject('service:stripe', 'stripeConfig', 'config:stripe');
}

export default {
  name: 'stripe',
  initialize
};
