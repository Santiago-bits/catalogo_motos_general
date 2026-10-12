import { Pipe, PipeTransform } from '@angular/core';
import { ProductPrice } from '../core/models/product.model';

const formatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

/** Formatea un precio como en el diseño: "US$ 12.500" o "$ 1.399.000". */
@Pipe({ name: 'price', standalone: true })
export class PricePipe implements PipeTransform {
  transform(value: ProductPrice | number | null | undefined, currency = 'ARS'): string {
    if (value === null || value === undefined) return '';

    let amount: number;
    if (typeof value === 'number') {
      amount = value;
    } else {
      amount = value.is_offer && value.offer ? value.offer : value.final;
      currency = value.currency;
    }

    const symbol = currency === 'USD' ? 'US$' : '$';
    return `${symbol} ${formatter.format(amount)}`;
  }
}
