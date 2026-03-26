# OMG Feedback Management System

A comprehensive feedback management platform for service-oriented businesses. This system allows customers to provide feedback at service counters through interactive kiosks, with real-time analytics, sentiment analysis, and role-based branch management.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [Database](#database)
- [API Documentation](#api-documentation)
- [User Roles & Permissions](#user-roles--permissions)
- [Development](#development)
- [Testing](#testing)
- [Contributing](#contributing)

## Features

### Core Functionality

- **Customer Feedback Collection**: Capture ratings (1-5 scale) and comments at service counters
- **Sentiment Analysis**: Automatic sentiment classification (very_positive, positive, neutral, negative, very_negative)
- **Real-time Analytics**: Dashboard with feedback statistics, trends, and KPIs
- **Servicer Performance Tracking**: Monitor individual servicer ratings and feedback
- **Counter Performance Analytics**: Track performance metrics per service counter (kiosk)
- **QR Token Management**: Secure QR codes for servicer activation and session tracking

### Multi-Branch Support

- **Branch Management**: Organize feedback collection across multiple locations/branches
- **Branch-Level Analytics**: Isolated data views for each branch
- **Role-Based Access Control**: Super admin, admin, branch_manager, and servicer roles
- **Branch Manager Access**: Branch managers can only view and manage data from their assigned branch

### Tag Management

- **Feedback Tagging**: Categorize feedback with custom tags
- **Branch-Scoped Tags**: Each branch can have its own tag categories
- **Tag Analytics**: Track which feedback tags are most common

### Session Management

- **Counter Sessions**: Track customer sessions at service counters
- **Session Lifecycle**: Recording of session start, customer service, and feedback submission
- **Session History**: Complete audit trail of all counter interactions

## Tech Stack

### Backend

- **Framework**: Laravel 12
- **Database**: SQLite (default), configurable for MySQL, PostgreSQL
- **API Framework**: Inertia.js + Sanctum for authentication
- **Testing**: Pest PHP testing framework
- **Code Quality**: Laravel Pint (PHP code formatter)

### Frontend

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Library**: Radix UI components
- **Animations**: Framer Motion
- **Date Handling**: date-fns
- **State Management**: Inertia.js props
- **Linting**: ESLint with TypeScript support

### DevOps & Tools

- **Package Management**: Composer (PHP), npm (Node.js)
- **Code Formatting**: Prettier with Tailwind plugin
- **Concurrency**: Concurrent npm scripts
- **Validation**: Ziggy for route generation

## Prerequisites

### System Requirements

- **PHP**: 8.2 or higher
- **Node.js**: 16 or higher
- **npm**: 8 or higher
- **Composer**: Latest version
- **Database**: SQLite (comes with PHP) or MySQL/PostgreSQL

### Optional but Recommended

- **Git**: For version control
- **Docker**: For containerized development environment
- **VS Code**: Recommended IDE with Laravel & Inertia extensions

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/kode-ksk-community/omg_feedback.git
cd omg_feedback
```

### 2. Install PHP Dependencies

```bash
composer install
```

### 3. Install Node Dependencies

```bash
npm install
```

### 4. Create Environment File

```bash
cp .env.example .env
```

### 5. Generate Application Key

```bash
php artisan key:generate
```

### 6. Create Database (SQLite by default)

```bash
# SQLite database will be created automatically at storage/app/database.sqlite
php artisan migrate
```

### 7. Seed Database (Optional - adds sample data)

```bash
php artisan db:seed
```

## Configuration

### Environment Variables

Edit `.env` file to customize:

```env
# Application
APP_NAME=OMG_Feedback
APP_ENV=local
APP_DEBUG=true
APP_TIMEZONE=Asia/Manila

# Database
DB_CONNECTION=sqlite
# For MySQL, uncomment and configure:
# DB_CONNECTION=mysql
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_DATABASE=omg_feedback
# DB_USERNAME=root
# DB_PASSWORD=

# Session & Cache
SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database

# Broadcasting
BROADCAST_CONNECTION=log

# File Storage
FILESYSTEM_DISK=local
```

### Database Connection Options

**SQLite (Default)**

```env
DB_CONNECTION=sqlite
```

**MySQL**

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=omg_feedback
DB_USERNAME=root
DB_PASSWORD=your_password
```

**PostgreSQL**

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=omg_feedback
DB_USERNAME=postgres
DB_PASSWORD=your_password
```

## Running the Application

### Development Mode

**Terminal 1 - Start PHP Development Server:**

```bash
php artisan serve
```

Server will run on `http://127.0.0.1:8000`

**Terminal 2 - Start Vite Development Server (for frontend assets):**

```bash
npm run dev
```

Hot module replacement enabled for instant frontend updates

### Production Build

```bash
# Build frontend assets for production
npm run build

# Optimize Laravel for production
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### Common Commands

```bash
# Run database migrations
php artisan migrate

# Rollback migrations
php artisan migrate:rollback

# Refresh database (drop all tables and re-migrate)
php artisan migrate:refresh

# Seed database with sample data
php artisan db:seed

# Create a new controller
php artisan make:controller ControllerName

# Create a new model with migration
php artisan make:model ModelName -m

# Format code with Pint
composer run lint

# Format frontend code with Prettier
npm run format

# Check code formatting without making changes
npm run format:check
```

## Project Structure

```
omg_feedback/
├── app/
│   ├── Http/
│   │   ├── Controllers/          # API & Web controllers
│   │   ├── Middleware/           # HTTP middleware
│   │   └── Requests/             # Form requests & validation
│   ├── Models/                   # Eloquent models
│   ├── Providers/                # Service providers (AppServiceProvider, etc.)
│   └── Traits/                   # Reusable traits (ApiResponse, etc.)
├── bootstrap/
│   ├── app.php                   # Application bootstrap
│   └── providers.php             # Service provider registration
├── config/
│   ├── app.php                   # Application config
│   ├── auth.php                  # Authentication config
│   ├── database.php              # Database connections
│   └── ...
├── database/
│   ├── migrations/               # Database migrations
│   ├── factories/                # Model factories for testing
│   └── seeders/                  # Database seeders
├── public/
│   ├── index.php                 # Application entry point
│   └── assets/                   # Static assets (once built)
├── resources/
│   ├── js/                       # React components & logic
│   │   ├── pages/                # Page components (admin, client)
│   │   │   ├── admin/            # Admin dashboard pages
│   │   │   └── client/           # Client/public facing pages
│   │   └── components/           # Reusable React components
│   ├── css/                      # Tailwind CSS styles
│   └── views/                    # PHP/Inertia view templates
├── routes/
│   ├── api.php                   # API routes (RESTful endpoints)
│   ├── web.php                   # Web routes (Inertia pages)
│   ├── auth.php                  # Authentication routes
│   └── settings.php              # Settings routes
├── storage/
│   ├── app/                      # File storage
│   ├── framework/                # Framework storage
│   └── logs/                     # Application logs
├── tests/
│   ├── Feature/                  # Feature tests
│   └── Unit/                     # Unit tests
├── vendor/                       # Composer dependencies (gitignored)
├── node_modules/                 # npm dependencies (gitignored)
├── .env.example                  # Environment variables template
├── composer.json                 # PHP dependencies
├── package.json                  # Node.js dependencies
├── vite.config.js               # Vite configuration
├── tsconfig.json                # TypeScript configuration
├── tailwind.config.js           # Tailwind CSS configuration
└── README.md                     # This file
```

## Database

### Key Tables

| Table                | Purpose                                           |
| -------------------- | ------------------------------------------------- |
| `users`              | System users (admins, branch_managers, servicers) |
| `branches`           | Service branch locations                          |
| `counters`           | Service counters (kiosks) at branches             |
| `counter_sessions`   | Customer sessions at counters                     |
| `feedbacks`          | Customer feedback records                         |
| `tags`               | Feedback categories/tags                          |
| `servicer_qr_tokens` | QR codes for servicer activation                  |
| `system_settings`    | System-wide configurations                        |

### Migrations

Run all migrations:

```bash
php artisan migrate
```

Migrate specific migration:

```bash
php artisan migrate --path=database/migrations/2026_03_18_102530_create_feedbacks_table.php
```

Rollback last batch:

```bash
php artisan migrate:rollback
```

View migration status:

```bash
php artisan migrate:status
```

## API Documentation

### Public Endpoints (No Auth Required)

```
GET  /api/health                          - Health check
GET  /api/counter/setup/{qr_token}        - Get counter setup data
POST /api/counter/activate                - Activate servicer with QR token
```

### Authenticated Endpoints

**Dashboard**

```
GET    /api/admin/dashboard/stats         - Get dashboard statistics
GET    /api/admin/dashboard/analytics     - Get analytics data
```

**Feedback Management**

```
GET    /api/feedbacks                     - List feedbacks (paginated)
POST   /api/feedbacks                     - Create feedback
GET    /api/feedbacks/{id}                - Get feedback detail
DELETE /api/feedbacks/{id}                - Delete feedback
GET    /api/feedbacks/analytics           - Feedback analytics
GET    /api/servicer-performance          - Servicer performance metrics
GET    /api/counter-performance           - Counter performance metrics
```

**Tags (Feedback Categories)**

```
GET    /api/tags                          - List tags
POST   /api/tags                          - Create tag
PUT    /api/tags/{id}                     - Update tag
DELETE /api/tags/{id}                     - Delete tag
PATCH  /api/tags/{id}/toggle              - Toggle tag active status
```

**Users & Servicers**

```
GET    /api/users                         - List users
GET    /api/users/{id}                    - Get user detail
POST   /api/users                         - Create user
PUT    /api/users/{id}                    - Update user
DELETE /api/users/{id}                    - Delete user
POST   /api/users/{id}/generate-qr        - Generate QR token
POST   /api/users/{id}/revoke-qr          - Revoke QR token
GET    /api/servicers/{id}/stats          - Get servicer statistics
```

**Branches**

```
GET    /api/branches                      - List branches
POST   /api/branches                      - Create branch
PUT    /api/branches/{id}                 - Update branch
DELETE /api/branches/{id}                 - Delete branch
```

**Counters**

```
GET    /api/counters                      - List counters
POST   /api/counters                      - Create counter
PUT    /api/counters/{id}                 - Update counter
DELETE /api/counters/{id}                 - Delete counter
PATCH  /api/counters/{id}/toggle          - Toggle counter status
POST   /api/counters/{id}/force-end       - Force end active session
```

### Response Format

All API responses follow a consistent format:

**Success Response**

```json
{
    "success": true,
    "message": "Operation successful",
    "data": {
        /* response data */
    }
}
```

**Error Response**

```json
{
    "success": false,
    "message": "Error message",
    "errors": {
        /* validation errors if applicable */
    }
}
```

## User Roles & Permissions

### Super Admin

- Full system access
- Create/manage all branches
- Create/manage all users
- View all feedback and analytics
- Manage global system settings
- Access all tags and counters

### Admin

- Manage assigned branches
- Cannot create super admins
- Cannot access other branches' data
- Full analytics access for assigned branches
- Manage branch-specific users and counters

### Branch Manager

- Restricted to assigned branch only
- View only their branch's data
- Manage counters in their branch
- View servicer performance in their branch
- Create and manage tags for their branch
- Cannot create other branch managers or admins
- Cannot view data outside their branch

### Servicer

- View own performance metrics
- View feedback submitted for them
- Cannot modify system data
- Access tier-based features

### Client (Public)

- No authentication required
- Submit feedback at counters
- View counter setup details via QR token

## Development

### Code Standards

**PHP Code**

```bash
# Format PHP code with Pint
composer run lint

# The project uses PSR-12 coding standards
```

**JavaScript/TypeScript Code**

```bash
# Format frontend code
npm run format

# Check formatting without changes
npm run format:check

# Lint code
npm run lint

# Configured with ESLint + Prettier + Tailwind plugin
```

### Creating New Features

1. **Create Database Migration** (if needed)

    ```bash
    php artisan make:migration create_table_name
    ```

2. **Create Model** (if needed)

    ```bash
    php artisan make:model ModelName -m
    ```

3. **Create Controller**

    ```bash
    php artisan make:controller ModelNameController
    ```

4. **Add Routes**

    - API routes: `routes/api.php`
    - Web routes: `routes/web.php`

5. **Create React Component**

    ```bash
    # Create new component in resources/js/pages/ or resources/js/components/
    ```

6. **Add Tests**
    ```bash
    php artisan make:test FeatureNameTest
    ```

### Key Conventions

- **Models**: Singular noun (User, Feedback, Tag)
- **Controllers**: `{Model}Controller` format
- **Routes**: RESTful conventions (GET, POST, PUT, DELETE)
- **Components**: PascalCase naming
- **Database Tables**: Plural noun (users, feedbacks, tags)
- **Migrations**: Timestamp + descriptive name

## Testing

### Run All Tests

```bash
php artisan test
```

### Run Specific Test File

```bash
php artisan test --path=tests/Feature/UserTest.php
```

### Run with Coverage Report

```bash
php artisan test --coverage
```

### Write New Test

```bash
php artisan make:test FeatureNameTest
php artisan make:test Unit/ModelNameTest --unit
```

Tests are located in `tests/` directory:

- `Feature/` - Feature/integration tests
- `Unit/` - Unit tests for isolated components

The project uses **Pest PHP** for testing with **Mockery** for mocking.

## Contributing

### Getting Started

1. Create a feature branch from `main`: `git checkout -b feature/your-feature-name`
2. Make your changes following the code standards
3. Test your changes: `php artisan test && npm run format:check`
4. Commit with descriptive messages: `git commit -m "feat: add new feature"`
5. Push to your branch: `git push origin feature/your-feature-name`
6. Create a Pull Request with detailed description

### Commit Message Format

Follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting)
- `refactor:` Code refactoring
- `test:` Test additions/modifications
- `chore:` Build, dependencies, tooling

### Branch Naming

- Feature: `feature/description`
- Bug fix: `fix/description`
- Documentation: `docs/description`
- Chore: `chore/description`

### Pull Request Guidelines

- Provide clear description of changes
- Reference related issues
- Include screenshot/video for UI changes
- Ensure all tests pass
- Request review from team members

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support & Contact

For questions, issues, or suggestions:

- **GitHub Issues**: Create an issue on the repository
- **Community**: Join our community discussions
- **Email**: Contact the development team

## Changelog

### Version 1.0.0 (Current)

- Initial release
- Core feedback collection system
- Branch-based management
- Role-based access control
- Real-time analytics dashboard
- Sentiment analysis
- Servicer performance tracking
- QR token management

---

**Last Updated**: March 26, 2026
**Maintained By**: Kode KSK Community
