import React from 'react';
    import { Helmet } from 'react-helmet';
    import PlaceholderPage from '@/components/PlaceholderPage';

    const BillOfMaterialsPage = () => {
      return (
        <>
          <Helmet>
            <title>Bill of Materials - Pabrikasi</title>
            <meta name="description" content="Kelola Bill of Materials (BOM)." />
          </Helmet>
          <PlaceholderPage title="Bill of Materials (BOM)" />
        </>
      );
    };

    export default BillOfMaterialsPage;