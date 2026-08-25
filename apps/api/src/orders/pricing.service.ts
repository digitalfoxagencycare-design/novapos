import { Injectable } from '@nestjs/common';
import { priceOrder, PricingError, TaxConfigError } from '@novapos/tax-engine';
import type {
  PriceOrderInput, PricedOrder, PricableLine, PricedLine,
} from '@novapos/tax-engine';
import { Errors } from '../common/errors';

export type PricedLineInput = PricableLine;
export type { PricedOrder, PricedLine };

/**
 * Server-side pricing.
 *
 * The arithmetic itself lives in `@novapos/tax-engine` so that the POS runs
 * the *same* code offline — two implementations would drift, and a till that
 * shows one number while the server charges another is a till nobody trusts.
 *
 * This class exists to translate the engine's errors into the API's error
 * vocabulary, so an offline client replaying a batch can tell a permanent
 * failure from a transient one.
 */
@Injectable()
export class PricingService {
  price(input: PriceOrderInput): PricedOrder {
    try {
      return priceOrder(input);
    } catch (err) {
      if (err instanceof PricingError) {
        // A bad rule set is an operator configuration problem; a bad line is a
        // client problem. Both are permanent, but they need different fixes,
        // so they get different codes.
        throw err.code === 'INVALID_RULE_SET'
          ? Errors.taxConfig(err.message)
          : Errors.validation(err.message);
      }
      if (err instanceof TaxConfigError) throw Errors.taxConfig(err.message);
      throw err;
    }
  }
}
