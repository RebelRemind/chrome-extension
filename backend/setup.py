from setuptools import setup

with open('requirements.txt', 'r', encoding='utf-8') as f:
    requirements = f.read().split('\n')

setup(
    name='backend',
    version='1.0.0',
    install_requires=requirements,
    py_modules=['webscraping', 'database', 'tests'],
    entry_points={
        'console_scripts': [
            'academic_calendar = webscraping.academic_calendar:default',
            'campus_wide_events = webscraping.campus_wide_events:main',
            'career_events = webscraping.career_events:main',
            'involvement_center = webscraping.involvement_center:default',
            'organizations = webscraping.organizations:default',
            'rebel_coverage = webscraping.rebel_coverage:default',
            'scarlet_and_gray_news = webscraping.scarlet_and_gray_news:main',
            'unlv_in_the_news = webscraping.unlv_in_the_news:main',
            'unlv_calendar = webscraping.unlv_calendar:default',
            'unlv_today = webscraping.unlv_today:main',
            'serve_data = database.serve_data:default',
            'test_academicCalendar = tests.test_academicCalendar:unittest.main',
            'test_involvementCenter = tests.test_involvementCenter:unittest.main',
            'test_organizations = tests.test_organizations:unittest.main',
            'test_rebelCoverage = tests.test_rebelCoverage:unittest.main',
            'test_serveData = tests.test_serveData:unittest.main',
            'test_unlvCalendar = tests.test_unlvCalendar:unittest.main'
        ]
    }
)
