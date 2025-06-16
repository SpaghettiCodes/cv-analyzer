# Hackathon hosted by Experian
## Problem statement:
Resume analysis is tedious and time consuming for HR:

- Categorize jobs into specific job descriptions
- Vetting each candidate for a particular job description 
 
Especially for large batches of resumes.

## Our Solution

A tool to simplify and speed up the workflow of resume categorization and analysis that is:

- fast
- accurate
- non-biased

All built on a singular webapp powered by OpenAI's GPT-4o model

## Tech Stack
Frontend: 
- ReactJS

Backend
- Python Flask
- MongoDB

## Screenshots
<ins>Resume List Page</ins>

![Resume List](https://github.com/user-attachments/assets/8320f704-efd4-4c68-a3d9-d4b6f3b515c2)

<ins>Job Description Page</ins>
![Job Description Page](https://github.com/user-attachments/assets/35abe01e-bf00-4ab2-9ef2-c6f9cbb29ed0)

<ins>Resume Matching & Analysis Page</ins>
![Resume Matching & Analysis](https://github.com/user-attachments/assets/129dea59-33cf-4fee-94c0-8652ef0f0865)




# How To Run Code

## Backend
## Environment Setup
```bash
. venv.sh
```
## Run Flask App
```bash
cd backend
flask run / uwsgi --ini uwsgi.ini
```


## Frontend
## Run React App
```bash
cd frontend
npm install
npm start
```
