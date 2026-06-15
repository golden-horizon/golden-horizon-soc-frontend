# Golden Horizon SOC Platform

A full-stack Security Operations Center (SOC) platform built to simulate how security teams monitor, investigate, and respond to cyber threats in a real environment.

I developed this project to strengthen my cybersecurity and software development skills while creating a practical portfolio project that combines security monitoring, incident response, threat investigation, and cloud deployment.

## What the Platform Does

The platform allows security analysts to:

* Monitor and manage security incidents
* Investigate suspicious activity and login events
* Review security alerts and attack indicators
* Track threat intelligence and attack trends
* Generate reports for technical and executive audiences
* Receive real-time security notifications
* Authenticate using a two-step login process (MFA)

## Key Features

* Incident Management Dashboard
* Investigation Center
* Security Events Monitoring
* Threat Hunting Workspace
* Threat Intelligence Dashboard
* Executive Dashboard
* Real-Time Alerts using Socket.IO
* Multi-Factor Authentication (MFA)
* JWT Authentication
* PostgreSQL Database
* Cloud Deployment

## Security Controls Implemented

This project includes several security-focused features:

* Brute Force Detection
* SQL Injection Detection
* Cross-Site Scripting (XSS) Detection
* Security Event Logging
* Authentication Monitoring
* Role-Based Access Control
* Secure HTTP Headers using Helmet

## Technology Stack

### Frontend

* React
* Vite
* Axios
* Recharts
* Socket.IO Client

### Backend

* Node.js
* Express.js
* Socket.IO
* JWT Authentication
* Helmet

### Database

* PostgreSQL
* Neon

### Hosting

* Vercel (Frontend)
* Render (Backend)

## Architecture

User → React Frontend → Node.js Backend → PostgreSQL Database

## Live Demo

Live Demo

Frontend:
https://golden-horizon-soc-frontend.vercel.app

Backend API:
https://golden-horizon-soc-backend.onrender.com

Health Check:
https://golden-horizon-soc-backend.onrender.com/


## Demo Access

Email: admin@test.com

Password: Admin@123456

MFA Code: 123456

## Why I Built This

As someone transitioning into cybersecurity, I wanted to build more than just a dashboard. My goal was to create a project that demonstrates practical SOC concepts including monitoring, detection, investigation, reporting, authentication, and cloud deployment.

Building this project gave me hands-on experience with full-stack development, PostgreSQL, API security, real-time communication, cloud infrastructure, and security operations workflows.

## Author

Navid Ghobadpour

Sydney, Australia

