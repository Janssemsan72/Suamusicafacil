import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Heart, Gift } from "@/lib/icons";
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface TipSectionProps {
  orderId: string;
  customerEmail: string;
}

export function TipSection({ orderId, customerEmail }: TipSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [donorName, setDonorName] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!donorName || donorName.trim() === '') {
      toast.error('Please enter your name');
      return;
    }

    setSubmitting(true);

    try {
      const amountCents = Math.round(parseFloat(amount) * 100);

      const { error } = await supabase.from('tips').insert({
        order_id: orderId,
        amount_cents: amountCents,
        donor_email: customerEmail,
        donor_name: donorName.trim(),
        message: message.trim() || null,
        status: 'pending',
      });

      if (error) throw error;

      toast.success('Thank you for your generosity! Your tip has been registered.');
      setIsOpen(false);
      setAmount('');
      setDonorName('');
      setMessage('');
    } catch (error: any) {
      console.error('Erro ao registrar gorjeta:', error);
      toast.error('Error registering tip. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-orange-900">
          <Gift className="h-5 w-5" />
          <span>Would you like to leave a tip?</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4">
          If you enjoyed your songs, consider leaving a tip to support our work!
        </p>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white">
              <Heart className="h-4 w-4 mr-2" />
              Leave a Tip
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Leave a Tip</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="amount">Amount ($)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="donorName">Your Name</Label>
                <Input
                  id="donorName"
                  type="text"
                  placeholder="Your name"
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="message">Message (optional)</Label>
                <Textarea
                  id="message"
                  placeholder="Leave a message of support..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {submitting ? 'Sending...' : 'Send Tip'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

