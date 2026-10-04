'use client';

/**
 * Contact — inquiry form. On submit, shows a toast (no backend needed for the
 * prototype; wire to an API route later if desired).
 */
import { useState } from 'react';
import { Mail, Phone, User, MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAppStore } from '@/state/useAppStore';
import { LiquidGlassSurface } from '@/components/ui/liquid-glass';

export function Contact() {
  const { toast } = useToast();
  const setStage = useAppStore((s) => s.setStage);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    // Simulate a request. Replace with a fetch to /api/inquiry when ready.
    setTimeout(() => {
      setSubmitting(false);
      (e.target as HTMLFormElement).reset();
      toast({
        title: 'Inquiry sent',
        description: "Thanks! Our leasing team will reach out within 24 hours.",
      });
    }, 700);
  };

  return (
    <section id="contact" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <LiquidGlassSurface variant="panel" className="overflow-hidden rounded-3xl shadow-lg">
          <div className="lg:grid lg:grid-cols-2">
          {/* Left: copy */}
          <div className="flex flex-col justify-center bg-gradient-to-br from-stone-900 to-stone-700 p-8 text-white sm:p-12">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
              Contact
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Book a private tour.
            </h2>
            <p className="mt-4 max-w-md text-stone-300">
              Tell us a little about what you&rsquo;re looking for and our team
              will arrange a tailored walkthrough — in person or in 3D.
            </p>
            <div className="mt-8 space-y-3 text-sm">
              <div className="flex items-center gap-3 text-stone-200">
                <Phone className="h-4 w-4 text-amber-300" />
                +1 (555) 010-2088
              </div>
              <div className="flex items-center gap-3 text-stone-200">
                <Mail className="h-4 w-4 text-amber-300" />
                leasing@ariaresidences.com
              </div>
            </div>
            <Button
              variant="secondary"
              className="mt-8 w-fit"
              onClick={() => setStage('CITY_ORBIT')}
            >
              Or explore apartments in 3D
            </Button>
          </div>

          {/* Right: form */}
          <form onSubmit={onSubmit} className="space-y-4 p-8 sm:p-12">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="name" name="name" required placeholder="Jordan Lee" className="pl-9" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="phone" name="phone" placeholder="+1 555 000 0000" className="pl-9" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" name="email" type="email" required placeholder="you@email.com" className="pl-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <div className="relative">
                <MessageSquare className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="message"
                  name="message"
                  rows={4}
                  placeholder="I'm interested in a 2-bedroom unit with a city view…"
                  className="pl-9"
                />
              </div>
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? 'Sending…' : (
                <>
                  Send inquiry
                  <Send className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              By submitting, you agree to be contacted about availability.
            </p>
          </form>
          </div>
        </LiquidGlassSurface>
      </div>
    </section>
  );
}
