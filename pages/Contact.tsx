import React, { useEffect, useRef, useState } from 'react';
import SEO from '../components/SEO';

const calendlyUrl = 'https://calendly.com/pranav-mercity/30min';

const Contact: React.FC = () => {
  const calendlyContainerRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
  });

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const onChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const subject = encodeURIComponent(`Mercity inquiry from ${form.name}${form.company ? ` (${form.company})` : ''}`);
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\nCompany: ${form.company || 'N/A'}\n\nMessage:\n${form.message}`
    );
    window.location.href = `mailto:pranav@mercity.io?subject=${subject}&body=${body}`;
  };

  return (
    <>
      <SEO
        title="Contact Us"
        description="Get in touch with Mercity to discuss applied AI research, enterprise deployments, and technical partnerships."
        url="/contact"
      />
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="max-w-3xl mb-14">
          <h1 className="text-5xl md:text-6xl font-light tracking-tight text-slate-900 mb-6">Contact Us</h1>
          <p className="text-lg text-slate-500 font-light leading-relaxed">
            Tell us what you are building and where your AI pipeline is stuck. We will follow up quickly with the right next step.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <section className="bg-white/80 border border-slate-200 rounded-2xl p-8">
            <h2 className="text-2xl font-light text-slate-900 mb-6">Send a Message</h2>
            <form className="space-y-5" onSubmit={onSubmit}>
              <div>
                <label htmlFor="name" className="block text-sm text-slate-700 mb-2">Name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={onChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400 bg-white"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm text-slate-700 mb-2">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={onChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400 bg-white"
                />
              </div>
              <div>
                <label htmlFor="company" className="block text-sm text-slate-700 mb-2">Company</label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  value={form.company}
                  onChange={onChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400 bg-white"
                />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm text-slate-700 mb-2">Message</label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={6}
                  value={form.message}
                  onChange={onChange}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400 bg-white resize-y"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-slate-900 text-white rounded-full text-sm font-semibold uppercase tracking-wider hover:bg-slate-800 transition-colors"
              >
                Send Email
              </button>
            </form>
          </section>

          <section className="bg-white/80 border border-slate-200 rounded-2xl p-8">
            <h2 className="text-2xl font-light text-slate-900 mb-2">Book a Call</h2>
            <p className="text-slate-500 font-light mb-6">Schedule a 30-minute conversation directly.</p>
            <div
              ref={calendlyContainerRef}
              className="calendly-inline-widget rounded-xl overflow-hidden border border-slate-200"
              data-url={calendlyUrl}
              style={{ minWidth: '320px', height: '680px' }}
            />
          </section>
        </div>
      </div>
    </>
  );
};

export default Contact;
