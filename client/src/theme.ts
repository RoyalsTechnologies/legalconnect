import type { ThemeConfig } from 'antd';

/** Brand-aligned Ant Design theme for LegalConnect Ghana. */
export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1f4a9a',
    colorLink: '#1f4a9a',
    colorInfo: '#1f4a9a',
    colorSuccess: '#0f7a4d',
    colorWarning: '#9a6700',
    colorError: '#b42318',
    colorText: '#0c1628',
    colorTextSecondary: '#5c6b82',
    colorBorder: '#d7deea',
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f3f6fb',
    borderRadius: 10,
    fontFamily: 'Manrope, ui-sans-serif, system-ui, sans-serif',
    fontSize: 15,
    lineWidth: 1,
    controlHeight: 42,
    boxShadowTertiary: '0 1px 2px rgba(12, 22, 40, 0.04), 0 10px 28px rgba(12, 22, 40, 0.06)',
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      headerHeight: 68,
      headerPadding: '0 24px',
      bodyBg: '#f3f6fb',
      footerBg: '#0c1628',
      footerPadding: '32px 24px',
    },
    Menu: {
      itemBorderRadius: 8,
      horizontalItemSelectedColor: '#173a7a',
      horizontalItemHoverColor: '#1f4a9a',
    },
    Button: {
      fontWeight: 600,
      borderRadius: 8,
    },
    Card: {
      borderRadiusLG: 12,
    },
    Input: {
      borderRadius: 8,
    },
    Tag: {
      borderRadiusSM: 6,
    },
    Typography: {
      titleMarginBottom: '0.35em',
      titleMarginTop: 0,
    },
  },
};
