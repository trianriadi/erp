import React from 'react';
import { Helmet } from 'react-helmet';
import PlaceholderPage from '@/components/PlaceholderPage';
import { Percent } from 'lucide-react';

const CorporateTaxPage = () => {
  return (
    <>
      <Helmet>
        <title>Pajak Penghasilan (PPh Badan) - Finance</title>
        <meta name="description" content="Halaman untuk mengelola Pajak Penghasilan (PPh Badan)." />
      </Helmet>
      <PlaceholderPage
        icon={Percent}
        title="Pajak Penghasilan (PPh Badan)"
        description="Fitur ini sedang dalam pengembangan. Di sini Anda akan dapat mengelola estimasi PPh Badan, melihat jurnal terkait, dan melacak status pembayaran pajak."
      />
    </>
  );
};

export default CorporateTaxPage;