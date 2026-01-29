# mobiFaktura - Documentation Index

**Version:** 1.0  
**Last Updated:** January 29, 2026

Welcome to the mobiFaktura documentation! This index will help you find the information you need.

---

## 📚 Quick Start

**New to mobiFaktura?** Start here:

1. 👤 **End Users** → [USER_GUIDE.md](USER_GUIDE.md)
2. 👨‍💻 **Developers** → [FEATURES.md](FEATURES.md) → [ARCHITECTURE.md](ARCHITECTURE.md)
3. 🚀 **DevOps** → [DEPLOYMENT.md](DEPLOYMENT.md)
4. 🔧 **Admins** → [ADMIN_QUICKREF.md](ADMIN_QUICKREF.md)

---

## 📖 Core Documentation

### Essential Reading

| Document | Description | Audience |
|----------|-------------|----------|
| **[README.md](../README.md)** | Project overview, quick start, features | Everyone |
| **[FEATURES.md](FEATURES.md)** | Complete feature documentation | Developers, PMs |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | System architecture and design | Developers, Architects |
| **[API.md](API.md)** | tRPC API reference | Developers |
| **[DEPLOYMENT.md](DEPLOYMENT.md)** | Production deployment guide | DevOps, SysAdmins |
| **[USER_GUIDE.md](USER_GUIDE.md)** | End-user documentation | Users, Support |

---

## 👥 By Role

### For End Users

- **[USER_GUIDE.md](USER_GUIDE.md)** - Complete user manual
  - Uploading invoices
  - Budget requests
  - Viewing balance
  - Notifications
  - Mobile app installation
  - Troubleshooting

### For Developers

**Getting Started:**
- [README.md](../README.md) - Setup and installation
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design
- [LOGIC.md](LOGIC.md) - Business logic and flows
- [rules.md](rules.md) - Development conventions

**Feature Documentation:**
- [FEATURES.md](FEATURES.md) - All features detailed
- [API.md](API.md) - API endpoints and usage
- [INVOICE_TYPES_QUICKREF.md](INVOICE_TYPES_QUICKREF.md) - Invoice types
- [KSEF_QUICKREF.md](KSEF_QUICKREF.md) - KSeF integration
- [SALDO_QUICKREF.md](SALDO_QUICKREF.md) - Balance system
- [MONEY_TRANSFERRED_QUICKREF.md](MONEY_TRANSFERRED_QUICKREF.md) - Payment workflow

**Technical Details:**
- [PWA_IMPLEMENTATION.md](PWA_IMPLEMENTATION.md) - Progressive Web App
- [TESTING.md](TESTING.md) - Testing strategy
- [LOGGING.md](LOGGING.md) - Logging system
- [LOGGING_QUICKREF.md](LOGGING_QUICKREF.md) - Quick logging reference
- [MONITORING.md](MONITORING.md) - Monitoring and health checks
- [RATE_LIMITING.md](RATE_LIMITING.md) - Rate limiting policies

### For Administrators

- **[ADMIN_QUICKREF.md](ADMIN_QUICKREF.md)** - Admin panel quick reference
- **[ADMIN_ACCOUNT_MANAGEMENT.md](ADMIN_ACCOUNT_MANAGEMENT.md)** - User management
- **[DATA_LIFECYCLE_STRATEGY.md](DATA_LIFECYCLE_STRATEGY.md)** - Data retention policies
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Server deployment
- **[MONITORING.md](MONITORING.md)** - System monitoring

### For DevOps

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide
  - Docker configuration
  - Environment variables
  - Database setup
  - Backup and recovery
  - Performance tuning
- **[MONITORING.md](MONITORING.md)** - Monitoring setup
- **[DATA_LIFECYCLE_STRATEGY.md](DATA_LIFECYCLE_STRATEGY.md)** - Automated cleanup

---

## 🎯 By Topic

### Invoice Management

- [FEATURES.md](FEATURES.md) - Invoice features overview
- [INVOICE_TYPES_QUICKREF.md](INVOICE_TYPES_QUICKREF.md) - Types: e-invoices, receipts, corrections
- [INVOICE_TYPES_IMPLEMENTATION.md](INVOICE_TYPES_IMPLEMENTATION.md) - Technical implementation
- [KSEF_QUICKREF.md](KSEF_QUICKREF.md) - KSeF e-invoicing integration
- [KSEF_COMPLETE_INTEGRATION.md](KSEF_COMPLETE_INTEGRATION.md) - Complete KSeF details
- [USER_GUIDE.md](USER_GUIDE.md) - User instructions

### Financial Features

- [SALDO_QUICKREF.md](SALDO_QUICKREF.md) - Balance system quick reference
- [SALDO_SYSTEM.md](SALDO_SYSTEM.md) - Complete saldo documentation
- [MONEY_TRANSFERRED_QUICKREF.md](MONEY_TRANSFERRED_QUICKREF.md) - Payment status workflow
- [FEATURES.md](FEATURES.md) - Budget requests and advances

### Authentication & Security

- [README.md](../README.md) - Security architecture overview
- [RATE_LIMITING.md](RATE_LIMITING.md) - Rate limiting and lockout
- [ADMIN_ACCOUNT_MANAGEMENT.md](ADMIN_ACCOUNT_MANAGEMENT.md) - User account security

### System Administration

- [ADMIN_QUICKREF.md](ADMIN_QUICKREF.md) - Admin features
- [ADMIN_ACCOUNT_MANAGEMENT.md](ADMIN_ACCOUNT_MANAGEMENT.md) - User/company management
- [DATA_LIFECYCLE_STRATEGY.md](DATA_LIFECYCLE_STRATEGY.md) - Data cleanup policies
- [MONITORING.md](MONITORING.md) - System health monitoring

### Development

- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [LOGIC.md](LOGIC.md) - Application logic
- [API.md](API.md) - API reference
- [TESTING.md](TESTING.md) - Testing guidelines
- [LOGGING.md](LOGGING.md) - Logging best practices
- [rules.md](rules.md) - Code conventions

### Deployment & Operations

- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment
- [MONITORING.md](MONITORING.md) - Monitoring setup
- [DATA_LIFECYCLE_STRATEGY.md](DATA_LIFECYCLE_STRATEGY.md) - Backup and cleanup

---

## 🔍 Finding Information

### I want to...

**Learn how to use the system:**
→ [USER_GUIDE.md](USER_GUIDE.md)

**Understand the architecture:**
→ [ARCHITECTURE.md](ARCHITECTURE.md)

**Deploy to production:**
→ [DEPLOYMENT.md](DEPLOYMENT.md)

**Integrate with the API:**
→ [API.md](API.md)

**Manage users:**
→ [ADMIN_ACCOUNT_MANAGEMENT.md](ADMIN_ACCOUNT_MANAGEMENT.md)

**Understand invoice types:**
→ [INVOICE_TYPES_QUICKREF.md](INVOICE_TYPES_QUICKREF.md)

**Set up KSeF integration:**
→ [KSEF_QUICKREF.md](KSEF_QUICKREF.md)

**Learn about the balance system:**
→ [SALDO_QUICKREF.md](SALDO_QUICKREF.md)

**Troubleshoot issues:**
→ [DEPLOYMENT.md](DEPLOYMENT.md) (Troubleshooting section)  
→ [USER_GUIDE.md](USER_GUIDE.md) (User troubleshooting)

**Set up logging:**
→ [LOGGING.md](LOGGING.md)

**Configure monitoring:**
→ [MONITORING.md](MONITORING.md)

**Write tests:**
→ [TESTING.md](TESTING.md)

---

## 📊 Documentation Structure

```
docs/
├── INDEX.md                              # This file
│
├── Core Documentation
│   ├── FEATURES.md                       # Complete feature documentation
│   ├── ARCHITECTURE.md                   # System architecture
│   ├── LOGIC.md                          # Business logic
│   ├── API.md                            # API reference
│   ├── DEPLOYMENT.md                     # Deployment guide
│   └── USER_GUIDE.md                     # End-user manual
│
├── Feature-Specific
│   ├── INVOICE_TYPES_QUICKREF.md        # Invoice types
│   ├── INVOICE_TYPES_IMPLEMENTATION.md   # Invoice implementation
│   ├── KSEF_QUICKREF.md                 # KSeF quick reference
│   ├── KSEF_COMPLETE_INTEGRATION.md     # KSeF complete docs
│   ├── SALDO_QUICKREF.md                # Balance quick reference
│   ├── SALDO_SYSTEM.md                  # Balance system details
│   └── MONEY_TRANSFERRED_QUICKREF.md    # Payment workflow
│
├── Administration
│   ├── ADMIN_QUICKREF.md                # Admin quick reference
│   ├── ADMIN_ACCOUNT_MANAGEMENT.md      # User management
│   └── DATA_LIFECYCLE_STRATEGY.md       # Data retention
│
├── Technical
│   ├── PWA_IMPLEMENTATION.md            # Progressive Web App
│   ├── TESTING.md                       # Testing strategy
│   ├── LOGGING.md                       # Logging system
│   ├── LOGGING_QUICKREF.md              # Logging reference
│   ├── MONITORING.md                    # Monitoring setup
│   ├── RATE_LIMITING.md                 # Rate limiting
│   └── rules.md                         # Development rules
│
└── Project Root
    └── README.md                         # Project overview
```

---

## 🆕 Recently Updated

| Date | Document | Changes |
|------|----------|---------|
| 2026-01-29 | All documentation | Complete documentation overhaul |
| 2026-01-29 | FEATURES.md | Created comprehensive feature docs |
| 2026-01-29 | API.md | Created complete API reference |
| 2026-01-29 | DEPLOYMENT.md | Created deployment guide |
| 2026-01-29 | USER_GUIDE.md | Created end-user manual |
| 2026-01-29 | README.md | Updated with latest features |

---

## 📝 Documentation Standards

### For Contributors

When updating documentation:

1. **Keep it current:** Update docs when features change
2. **Be clear:** Write for your audience
3. **Add examples:** Show, don't just tell
4. **Update index:** Add new docs to this index
5. **Check links:** Ensure all cross-references work
6. **Use formatting:** Headers, lists, code blocks
7. **Date your changes:** Add date to "Last Updated"

### Document Templates

**Quick Reference:**
- Purpose and scope
- Quick examples
- Common patterns
- See also links

**Complete Documentation:**
- Table of contents
- Overview
- Detailed sections
- Examples
- Troubleshooting
- FAQ
- Related docs

---

## 🔗 External Resources

### Technologies Used

- **Next.js**: https://nextjs.org/docs
- **tRPC**: https://trpc.io/docs
- **Drizzle ORM**: https://orm.drizzle.team/docs
- **React Query**: https://tanstack.com/query/latest/docs
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Shadcn/UI**: https://ui.shadcn.com/docs
- **Docker**: https://docs.docker.com/
- **PostgreSQL**: https://www.postgresql.org/docs/
- **MinIO**: https://min.io/docs/

### Polish Standards

- **KSeF**: https://www.gov.pl/web/kas/ksef
- **e-Invoicing**: https://www.gov.pl/web/kas/krajowy-system-e-faktur

---

## 🤝 Contributing

Found an error or want to improve the docs?

1. Edit the relevant markdown file
2. Follow documentation standards
3. Submit a pull request
4. Update this index if adding new docs

---

## 📞 Support

**For Users:**
- Check [USER_GUIDE.md](USER_GUIDE.md)
- Contact your accountant or administrator

**For Developers:**
- Check relevant technical docs
- Review [API.md](API.md) and [ARCHITECTURE.md](ARCHITECTURE.md)
- Check logs and error messages

**For Administrators:**
- Check [ADMIN_QUICKREF.md](ADMIN_QUICKREF.md)
- Review [MONITORING.md](MONITORING.md) for system health
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for troubleshooting

---

## 📈 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-29 | Complete documentation overhaul |
| 0.9 | 2026-01-XX | Previous documentation versions |

---

**Happy reading! 📚**

*Last updated: January 29, 2026*
