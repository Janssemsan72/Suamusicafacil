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
      toast.error('Por favor, informe um valor válido');
      return;
    }

    if (!donorName || donorName.trim() === '') {
      toast.error('Por favor, informe seu nome');
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

      toast.success('Obrigado pela sua generosidade! Sua gorjeta foi registrada.');
      setIsOpen(false);
      setAmount('');
      setDonorName('');
      setMessage('');
    } catch (error: any) {
      console.error('Erro ao registrar gorjeta:', error);
      toast.error('Erro ao registrar gorjeta. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-orange-900">
          <Gift className="h-5 w-5" />
          <span>Deseja dar uma gorjeta?</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4">
          Se você gostou das suas músicas, considere dar uma gorjeta para apoiar nosso trabalho!
        </p>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white">
              <Heart className="h-4 w-4 mr-2" />
              Dar Gorjeta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dar Gorjeta</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="amount">Valor (R$)</Label>
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
                <Label htmlFor="donorName">Seu Nome</Label>
                <Input
                  id="donorName"
                  type="text"
                  placeholder="Seu nome"
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="message">Mensagem (opcional)</Label>
                <Textarea
                  id="message"
                  placeholder="Deixe uma mensagem de apoio..."
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
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {submitting ? 'Enviando...' : 'Enviar Gorjeta'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

