import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';
import { Input } from '../../components/ui';
import { SelectField } from '../../components/ui';

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: 8 }}>{t('settings.title')}</h1>
      <div className="glass-panel" style={{ padding: 24 }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <SelectField
            label={t('settings.currency')}
            value={settings.currencySymbol}
            onValueChange={(value) => updateSettings({ currencySymbol: value as 'Rs.' | 'रू' })}
            options={[{ value: 'Rs.', label: 'Rs.' }, { value: 'रू', label: 'रू' }]}
          />

          <div className="ds-field">
            <label className="ds-label">{t('settings.vat')}</label>
            <Input
              type="number"
              min={0}
              max={25}
              value={settings.vatRate}
              onChange={(event) => updateSettings({ vatRate: Number(event.target.value) || 13 })}
            />
          </div>

          <SelectField
            label={t('settings.dateMode')}
            value={settings.dateMode}
            onValueChange={(value) => updateSettings({ dateMode: value as 'AD' | 'BS' })}
            options={[{ value: 'AD', label: 'AD' }, { value: 'BS', label: 'BS' }]}
          />

          <SelectField
            label={t('settings.language')}
            value={settings.language}
            onValueChange={(value) => updateSettings({ language: value as 'en' | 'ne' })}
            options={[{ value: 'en', label: 'English' }, { value: 'ne', label: 'नेपाली' }]}
          />

          <div className="ds-field">
            <label className="ds-label">{t('settings.businessName')}</label>
            <Input value={settings.businessName} onChange={(event) => updateSettings({ businessName: event.target.value })} />
          </div>

          <div className="ds-field">
            <label className="ds-label">{t('settings.businessAddress')}</label>
            <Input value={settings.businessAddress} onChange={(event) => updateSettings({ businessAddress: event.target.value })} />
          </div>

          <div className="ds-field">
            <label className="ds-label">{t('settings.panVat')}</label>
            <Input value={settings.panVatNumber} onChange={(event) => updateSettings({ panVatNumber: event.target.value })} />
          </div>
        </div>
      </div>
    </div>
  );
};
