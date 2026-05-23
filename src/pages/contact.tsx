import React, { useState } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Mail, Github, User, Send } from 'lucide-react'

export default function Contact() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  })

  const [loading, setLoading] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.name || !form.email || !form.subject || !form.message) {
      alert('Please fill all fields')
      return
    }

    setLoading(true)

    // fake API call
    await new Promise((res) => setTimeout(res, 1200))

    alert('Message sent successfully!')

    setForm({
      name: '',
      email: '',
      subject: '',
      message: '',
    })

    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">

      {/* Hero Section */}
      <section className="border-b border-border/50">
        <div className="container mx-auto px-6 py-20 text-center">

          <h1 className="text-5xl font-bold mb-4">
            Contact <span className="text-gradient">GitVerse</span>
          </h1>

          <p className="text-muted-foreground max-w-2xl mx-auto">
            Have questions, feedback, or ideas? We’d love to hear from you.
            Send us a message and we’ll respond as soon as possible.
          </p>

        </div>
      </section>

      {/* Content */}
      <section className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-10">

          {/* Left Info */}
          <Card className="glass">
            <CardHeader>
              <CardTitle>Get in Touch</CardTitle>
              <CardDescription>
                We usually respond within 24–48 hours
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">

              <div className="flex items-center gap-3 text-muted-foreground">
                <User size={18} />
                <span>GitVerse Support Team</span>
              </div>

              <div className="flex items-center gap-3 text-muted-foreground">
                <Mail size={18} />
                <span>support@gitverse.com</span>
              </div>

              <div className="flex items-center gap-3 text-muted-foreground">
                <Github size={18} />
                <span>github.com/gitverse</span>
              </div>

            </CardContent>
          </Card>

          {/* Right Form */}
          <Card className="glass">
            <CardHeader>
              <CardTitle>Send Message</CardTitle>
              <CardDescription>
                Fill the form below and we’ll get back to you
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">

                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Your name"
                  className="w-full p-3 rounded-md border border-border bg-background outline-none focus:ring-2 focus:ring-primary/40"
                />

                <input
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Your email"
                  className="w-full p-3 rounded-md border border-border bg-background outline-none focus:ring-2 focus:ring-primary/40"
                />

                <input
                  name="subject"
                  value={form.subject}
                  onChange={handleChange}
                  placeholder="Subject"
                  className="w-full p-3 rounded-md border border-border bg-background outline-none focus:ring-2 focus:ring-primary/40"
                />

                <textarea
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  placeholder="Your message..."
                  rows={5}
                  className="w-full p-3 rounded-md border border-border bg-background outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />

              </CardContent>

              <CardFooter>
                <Button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2"
                  disabled={loading}
                >
                  {loading ? (
                    'Sending...'
                  ) : (
                    <>
                      <Send size={16} />
                      Send Message
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>

          </Card>

        </div>
      </section>

    </main>
  )
}