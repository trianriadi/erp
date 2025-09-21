import React from 'react';
import { Helmet } from 'react-helmet';
import PlaceholderPage from '@/components/PlaceholderPage';

const ProductListPage = () => {
  return (
    <>
      <Helmet>
        <title>Product List - Engineering</title>
        <meta name="description" content="View and manage all engineered products." />
      </Helmet>
      <PlaceholderPage title="Product List" />
    </>
  );
};

export default ProductListPage;