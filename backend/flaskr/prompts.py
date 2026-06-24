TAGS_JSON = (
    '{"name": "candidate name", "github": "github username", '
    '"tag_ids": ["tagid1", "tagid2", "tagid3"]}'
)

ANALYSIS_JSON = (
    '{"name": "name", "summary": "short summary of past experiences.", '
    '"highlights": ["highlight1", "highlight2", "highlight3", "highlight4", "highlight5"], '
    '"qualifications": {"pastExperience": [{"name": "name of past experience", '
    '"priority": "priority", "minYears": 0, "qualified": "true / false (boolean)"}], '
    '"technical": [{"name": "name of technical skill", "priority": "priority", '
    '"minYears": 0, "qualified": "true / false (boolean)"}], '
    '"soft": [{"name": "name of soft skill", "priority": "priority", "minYears": 0, '
    '"qualified": "true / false (boolean)"}]}}'
)

JD_PARSED_SCHEMA = (
    '{"title": "job title (string)","mode": "work location (string)",'
    '"type": "employment type (string)","position": "job position (string)",'
    '"location": "location of job (string)","description": "description of job (string)",'
    '"qualifications": {"pastExperience": [{"name": "name of experience (string)",'
    '"priority": "mandatory","minYears": 3}],'
    '"technical": [{"name": "name of technical skill (string)",'
    '"priority": "bonus","minYears": 2}],'
    '"soft": [{"name": "name of soft skill (string)",'
    '"priority": "normal","minYears": 1}]},'
    '"responsibilities": ["responsibilities of work (string)"]}'
)

TAGS_SUGGESTION_SCHEMA = '{"tags": ["Tag 1", "Tag 2", "Tag 3", "Tag 4"]}'

RESUME_NEW_TAGS_JSON = '{"tag_ids": ["tagid1", "tagid2"]}'

PROFILE_JSON = (
    '{"strong_aspects": ["aspect1", "aspect2", "aspect3"], '
    '"interesting_facts": ["fact1", "fact2"], '
    '"career_summary": "one sentence career snapshot"}'
)
