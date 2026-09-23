import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '../../contexts/SettingsContext';

vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
});

const { POSView } = await import('./POSView');

describe('POSView', () => {
  it('renders the barcode-first search and empty-cart guidance', () => {
    const html = renderToStaticMarkup(
      <SettingsProvider>
        <POSView />
      </SettingsProvider>
    );

    expect(html).toContain('Scan barcode or search products');
    expect(html).toContain('Cart is empty');
    expect(html).toContain('Scan a barcode or select a product to add it to the cart.');
  });
});
