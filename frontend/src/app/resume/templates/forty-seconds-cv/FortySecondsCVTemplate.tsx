import { useCallback } from 'react';
import type { ResumeData, StyleSettings } from '../../types/resume';
import { BubbleDiagram, WheelChart } from '../../components/charts';
import { darkenColor } from '../../utils/colorUtils';
import { getLabel } from '../../lib/i18n/resumeLabels';
import { EditableText } from '../../components/EditableText';
import './FortySecondsCV.css';

interface Props {
    data: ResumeData;
    style: StyleSettings;
    onDataChange?: (data: ResumeData) => void;
}

// Skill dots component
function SkillDots({ level, max = 5 }: { level: number; max?: number }) {
    return (
        <div className="skill-dots">
            {Array.from({ length: max }).map((_, i) => (
                <div key={i} className={`skill-dot ${i < level ? 'filled' : 'empty'}`} />
            ))}
        </div>
    );
}

export function FortySecondsCVTemplate({ data, style, onDataChange }: Props) {
    const visibility = data.sectionVisibility;
    const showHobbies = visibility?.hobbies ?? (data.hobbies || []).length > 0;
    const showPublications = visibility?.publications ?? (data.publications || []).length > 0;
    const showAwards = visibility?.awards ?? (data.awards || []).length > 0;

    const cssVars = {
        '--primary-color': style.primaryColor,
        '--primary-dark': darkenColor(style.primaryColor, 15),
        '--font-size-base': `${style.fontSize}pt`,
        '--line-height': style.lineHeight,
        '--sidebar-width': `${style.sidebarWidth}%`,
        '--main-width': `${100 - style.sidebarWidth}%`,
        '--scale': style.fontSize / 10,
    } as React.CSSProperties;

    // Safe accessors with defaults
    const personal = data.personal || {};
    const experience = data.experience || [];
    const education = data.education || [];
    const skills = data.skills || [];
    const languages = data.languages || [];
    const socialLinks = data.socialLinks || [];
    const publications = data.publications || [];
    const awards = data.awards || [];
    const hobbies = data.hobbies || [];
    const lang = style.resumeLanguage || 'en';

    // Helper to update personal field
    const updatePersonal = useCallback((field: string, value: string) => {
        if (onDataChange) {
            onDataChange({
                ...data,
                personal: { ...data.personal, [field]: value },
            });
        }
    }, [data, onDataChange]);

    // Helper to update experience
    const updateExperience = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newExp = [...data.experience];
            newExp[index] = { ...newExp[index], [field]: value };
            onDataChange({ ...data, experience: newExp });
        }
    }, [data, onDataChange]);

    // Helper to update education
    const updateEducation = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newEdu = [...data.education];
            newEdu[index] = { ...newEdu[index], [field]: value };
            onDataChange({ ...data, education: newEdu });
        }
    }, [data, onDataChange]);

    const updateSkill = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newSkills = [...data.skills];
            newSkills[index] = { ...newSkills[index], [field]: value };
            onDataChange({ ...data, skills: newSkills });
        }
    }, [data, onDataChange]);

    const updatePublication = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newPubs = [...data.publications];
            newPubs[index] = { ...newPubs[index], [field]: value };
            onDataChange({ ...data, publications: newPubs });
        }
    }, [data, onDataChange]);

    const updateAward = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newAwards = [...data.awards];
            newAwards[index] = { ...newAwards[index], [field]: value };
            onDataChange({ ...data, awards: newAwards });
        }
    }, [data, onDataChange]);

    return (
        <div className="cv-container" style={cssVars}>
            {/* SIDEBAR */}
            <aside className="sidebar">
                {/* Profile Photo */}
                <div className="profile-section">
                    {personal.photo && (
                        <img src={personal.photo} alt="" className="profile-photo" />
                    )}
                    <EditableText
                        tag="h1"
                        className="profile-name"
                        value={personal.name || ''}
                        onChange={onDataChange ? (v) => updatePersonal('name', v) : undefined}
                        placeholder="Your Name"
                    />
                    <EditableText
                        tag="p"
                        className="profile-title"
                        value={personal.title || ''}
                        onChange={onDataChange ? (v) => updatePersonal('title', v) : undefined}
                        placeholder="Your Title"
                    />
                </div>

                {/* Contact Info */}
                <div className="sidebar-section">
                    <div className="section-title">{getLabel('contact', lang)}</div>
                    <div className="contact-info">
                        {(personal.email || onDataChange) && (
                            <div className="contact-item">
                                <span className="icon">✉</span>
                                <EditableText
                                    value={personal.email || ''}
                                    onChange={onDataChange ? (v) => updatePersonal('email', v) : undefined}
                                    placeholder="email@example.com"
                                />
                            </div>
                        )}
                        {(personal.phone || onDataChange) && (
                            <div className="contact-item">
                                <span className="icon">📞</span>
                                <EditableText
                                    value={personal.phone || ''}
                                    onChange={onDataChange ? (v) => updatePersonal('phone', v) : undefined}
                                    placeholder="Phone"
                                />
                            </div>
                        )}
                        {(personal.address || onDataChange) && (
                            <div className="contact-item">
                                <span className="icon">📍</span>
                                <EditableText
                                    value={personal.address || ''}
                                    onChange={onDataChange ? (v) => updatePersonal('address', v) : undefined}
                                    placeholder="Address"
                                />
                            </div>
                        )}
                        {personal.website && (
                            <div className="contact-item">
                                <span className="icon">🌐</span>
                                <span>{personal.website}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Social Links */}
                {socialLinks.length > 0 && (
                    <div className="sidebar-section">
                        <div className="section-title">Social</div>
                        {socialLinks.map((link, i) => (
                            <div key={i} className="social-item">
                                <span className="icon">{link.icon || '🔗'}</span>
                                <a href={link.url}>{link.username || link.platform}</a>
                            </div>
                        ))}
                    </div>
                )}

                {/* Languages */}
                {languages.length > 0 && (
                    <div className="sidebar-section">
                        <div className="section-title">{getLabel('languages', lang)}</div>
                        {languages.map((lang, i) => (
                            <div key={i} className="language-item">
                                <span className="language-flag">{lang.flag || '🏳️'}</span>
                                <span className="language-name">{lang.name}</span>
                                <SkillDots level={lang.levelNumber || 3} />
                            </div>
                        ))}
                    </div>
                )}

                {/* Skills */}
                {skills.length > 0 && (
                    <div className="sidebar-section">
                        <div className="section-title">{getLabel('skills', lang)}</div>
                        {skills.map((skill, i) => (
                            <div key={i} className="skill-item">
                                <span className="skill-icon">{skill.icon || '📌'}</span>
                                <EditableText
                                    tag="span"
                                    value={skill.name || ''}
                                    onChange={onDataChange ? (v) => updateSkill(i, 'name', v) : undefined}
                                    placeholder="Skill"
                                />
                                {skill.subSkills && skill.subSkills.length > 0 && (
                                    <div className="skill-subitems">
                                        {skill.subSkills.map((sub, j) => (
                                            <div key={j} className="skill-subitem">↳ {sub}</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* About Me with Diagrams */}
                {personal.summary && (
                    <div className="sidebar-section">
                        <div className="section-title">{getLabel('summary', lang)}</div>
                        <p className="about-text">{personal.summary}</p>
                    </div>
                )}

                {/* Bubble Diagram - Skills visualization */}
                {skills.length >= 3 && (
                    <div className="sidebar-section">
                        <div className="section-title">Skill Focus</div>
                        <BubbleDiagram
                            centerLabel="Core Skills"
                            items={skills.slice(0, 5).map(s => s.name)}
                            primaryColor={style.primaryColor}
                        />
                    </div>
                )}

                {/* Wheel Chart - Time allocation */}
                {experience.length > 0 && (
                    <div className="sidebar-section">
                        <div className="section-title">Focus Areas</div>
                        <WheelChart
                            items={[
                                { label: 'Development', value: 35 },
                                { label: 'Research', value: 25 },
                                { label: 'Analysis', value: 25 },
                                { label: 'Learning', value: 15 },
                            ]}
                            primaryColor={style.primaryColor}
                        />
                    </div>
                )}

                {/* Hobbies */}
                {showHobbies && hobbies.length > 0 && (
                    <div className="sidebar-section">
                        <div className="section-title">{getLabel('interests', lang)}</div>
                        <div className="hobbies-list">
                            {hobbies.map((hobby, i) => (
                                <span key={i} className="hobby-tag">{hobby.icon} {hobby.name}</span>
                            ))}
                        </div>
                    </div>
                )}
            </aside>

            {/* MAIN CONTENT */}
            <main className="main-content">
                {/* Summary */}
                {(personal.summary || onDataChange) && (
                    <section className="main-section">
                        <h2 className="main-section-title">{getLabel('summary', lang)}</h2>
                        <EditableText
                            tag="p"
                            className="summary-text"
                            value={personal.summary || ''}
                            onChange={onDataChange ? (v) => updatePersonal('summary', v) : undefined}
                            placeholder="Write a brief introduction about yourself..."
                        />
                    </section>
                )}

                {/* Experience */}
                {experience.length > 0 && (
                    <section className="main-section">
                        <h2 className="main-section-title">{getLabel('experience', lang)}</h2>
                        {experience.map((exp, index) => (
                            <div key={exp.id} className="cv-entry">
                                <div className="cv-entry-date">
                                    <EditableText
                                        tag="span"
                                        value={exp.startDate || ''}
                                        onChange={onDataChange ? (v) => updateExperience(index, 'startDate', v) : undefined}
                                        placeholder="Start"
                                    />{exp.endDate ? <> - <EditableText
                                        tag="span"
                                        value={exp.endDate || ''}
                                        onChange={onDataChange ? (v) => updateExperience(index, 'endDate', v) : undefined}
                                        placeholder="End"
                                    /></> : ''}
                                </div>
                                <div className="cv-entry-content">
                                    <EditableText
                                        tag="div"
                                        className="cv-entry-title"
                                        value={exp.position || ''}
                                        onChange={onDataChange ? (v) => updateExperience(index, 'position', v) : undefined}
                                        placeholder="Position"
                                    />
                                    <EditableText
                                        tag="div"
                                        className="cv-entry-org"
                                        value={exp.company || ''}
                                        onChange={onDataChange ? (v) => updateExperience(index, 'company', v) : undefined}
                                        placeholder="Company"
                                    />
                                    <EditableText
                                        tag="div"
                                        className="cv-entry-desc"
                                        value={exp.description || ''}
                                        onChange={onDataChange ? (v) => updateExperience(index, 'description', v) : undefined}
                                        placeholder="Description"
                                    />
                                    {exp.highlights && exp.highlights.length > 0 && (
                                        <ul className="cv-entry-highlights">
                                            {exp.highlights.map((h, i) => <li key={i}>{h}</li>)}
                                        </ul>
                                    )}
                                </div>
                                <div className="cv-entry-location">{exp.location}</div>
                            </div>
                        ))}
                    </section>
                )}

                {/* Education */}
                {education.length > 0 && (
                    <section className="main-section">
                        <h2 className="main-section-title">{getLabel('education', lang)}</h2>
                        {education.map((edu, index) => (
                            <div key={edu.id} className="cv-entry">
                                <div className="cv-entry-date">
                                    <EditableText
                                        tag="span"
                                        value={edu.startDate || ''}
                                        onChange={onDataChange ? (v) => updateEducation(index, 'startDate', v) : undefined}
                                        placeholder="Start"
                                    />{edu.endDate ? <> - <EditableText
                                        tag="span"
                                        value={edu.endDate || ''}
                                        onChange={onDataChange ? (v) => updateEducation(index, 'endDate', v) : undefined}
                                        placeholder="End"
                                    /></> : ''}
                                </div>
                                <div className="cv-entry-content">
                                    <EditableText
                                        tag="div"
                                        className="cv-entry-title"
                                        value={`${edu.degree || ''} ${edu.field || ''}`.trim()}
                                        onChange={onDataChange ? (v) => updateEducation(index, 'degree', v) : undefined}
                                        placeholder="Degree & Field"
                                    />
                                    <EditableText
                                        tag="div"
                                        className="cv-entry-org"
                                        value={edu.institution || ''}
                                        onChange={onDataChange ? (v) => updateEducation(index, 'institution', v) : undefined}
                                        placeholder="Institution"
                                    />
                                    {edu.description && <div className="cv-entry-desc">{edu.description}</div>}
                                </div>
                                <div className="cv-entry-location">{edu.location}</div>
                            </div>
                        ))}
                    </section>
                )}

                {/* Publications */}
                {showPublications && publications.length > 0 && (
                    <section className="main-section">
                        <h2 className="main-section-title">{getLabel('publications', lang)}</h2>
                        {publications.map((pub, i) => (
                            <div key={pub.id} className="cv-entry">
                                <div className="cv-entry-date">{pub.date}</div>
                                <div className="cv-entry-content">
                                    <EditableText
                                        tag="div"
                                        className="cv-entry-title"
                                        value={pub.title || ''}
                                        onChange={onDataChange ? (v) => updatePublication(i, 'title', v) : undefined}
                                        placeholder="Title"
                                    />
                                    <EditableText
                                        tag="div"
                                        className="cv-entry-org"
                                        value={pub.authors || ''}
                                        onChange={onDataChange ? (v) => updatePublication(i, 'authors', v) : undefined}
                                        placeholder="Authors"
                                    />
                                </div>
                                <div className="cv-entry-location">{pub.publisher}</div>
                            </div>
                        ))}
                    </section>
                )}

                {/* Awards */}
                {showAwards && awards.length > 0 && (
                    <section className="main-section">
                        <h2 className="main-section-title">{getLabel('awards', lang)}</h2>
                        {awards.map((award, i) => (
                            <div key={award.id} className="award-entry">
                                <div className="cv-entry-date">{award.date}</div>
                                <EditableText
                                    tag="div"
                                    value={award.title || ''}
                                    onChange={onDataChange ? (v) => updateAward(i, 'title', v) : undefined}
                                    placeholder="Award Title"
                                />
                                <div className="cv-entry-location">{award.issuer}</div>
                            </div>
                        ))}
                    </section>
                )}
            </main>
        </div>
    );
}
