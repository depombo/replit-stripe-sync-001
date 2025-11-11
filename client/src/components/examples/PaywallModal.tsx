import { useState } from 'react';
import PaywallModal from '../PaywallModal';
import { Button } from '@/components/ui/button';

export default function PaywallModalExample() {
  const [open, setOpen] = useState(true);
  
  return (
    <div className="p-8">
      <Button onClick={() => setOpen(true)}>Open Paywall</Button>
      <PaywallModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
