import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
  // @ts-expect-error - ignore apiVersion type error if version mismatch
  apiVersion: '2023-10-16',
  appInfo: {
    name: 'Therum',
    version: '0.1.0',
  },
});
