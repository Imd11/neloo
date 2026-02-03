import { useCallback } from 'react';
import type { ResumeData, StyleSettings } from '../../types/resume';
import { darkenColor } from '../../utils/colorUtils';
import { EditableText } from '../../components/EditableText';
import { getLabel } from '../../lib/i18n/resumeLabels';
import './HipsterCV.css';

interface Props {
    data: ResumeData;
    style: StyleSettings;
    onDataChange?: (data: ResumeData) => void;
}

export function HipsterCVTemplate({ data, style, onDataChange }: Props) {
    const { personal, experience, education, skills, languages, publications, projects, awards, certificates } = data;
    const visibility = data.sectionVisibility;
    const showCertificates = visibility?.certificates ?? (certificates?.length ?? 0) > 0;
    const showPublications = visibility?.publications ?? (publications?.length ?? 0) > 0;
    const showProjects = visibility?.projects ?? (projects?.length ?? 0) > 0;
    const showHobbies =
        visibility?.hobbies ??
        ((data.hobbies?.length ?? 0) > 0 || (awards?.length ?? 0) > 0);
    const lang = style.resumeLanguage || 'en';

    type HobbyLike = { id?: string; name?: string; title?: string };
    const hobbySource = (data.hobbies?.length ? data.hobbies : awards || []) as unknown as HobbyLike[];

    const cssVars = {
        '--primary-color': style.primaryColor,
        '--primary-dark': darkenColor(style.primaryColor, 15),
        '--font-size': `${style.fontSize}pt`,
        '--line-height': style.lineHeight,
        '--scale': style.fontSize / 10,
    } as React.CSSProperties;

    // Helper function for updating personal data
    const updatePersonal = useCallback((field: string, value: string) => {
        if (onDataChange) {
            onDataChange({
                ...data,
                personal: { ...data.personal, [field]: value },
            });
        }
    }, [data, onDataChange]);

    const updateExperience = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newExp = [...data.experience];
            newExp[index] = { ...newExp[index], [field]: value };
            onDataChange({ ...data, experience: newExp });
        }
    }, [data, onDataChange]);

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

    return (
        <div className="hipster-container" style={cssVars}>
            {/* Header Bar */}
            <header className="hipster-header">
                <div className="hipster-header-content">
                    <div className="hipster-title-area">
                        <span className="hipster-title-label">{personal.title || 'Professional'}</span>
                        <EditableText
                            tag="h1"
                            className="hipster-name"
                            value={personal.name || ''}
                            onChange={onDataChange ? (v) => updatePersonal('name', v) : undefined}
                            placeholder="Your Name"
                        />
                        <EditableText
                            tag="span"
                            className="hipster-subtitle"
                            value={personal.title || ''}
                            onChange={onDataChange ? (v) => updatePersonal('title', v) : undefined}
                            placeholder="Your Title"
                        />
                    </div>
                </div>
            </header>

            {/* Three Column Layout */}
            <div className="hipster-body">
                {/* Left Column - Facts & Skills */}
                <aside className="hipster-sidebar-left">
                    {/* Photo */}
                    {personal.photo && (
                        <div className="hipster-photo-container">
                            <img src={personal.photo} alt="" className="hipster-photo" />
                        </div>
                    )}

                    {/* Facts */}
                    <section className="hipster-section">
                        <h2 className="hipster-section-title">
                            <span className="hipster-title-text">FACTS</span>
                            <span className="hipster-title-sub">personal</span>
                        </h2>
                        <div className="hipster-facts">
                            {personal.name && (
                                <div className="hipster-fact">
                                    <span className="hipster-fact-icon">○</span>
                                    <span>{personal.name}</span>
                                </div>
                            )}
                            {personal.nationality && (
                                <div className="hipster-fact">
                                    <span className="hipster-fact-icon">●</span>
                                    <span>nationality: {personal.nationality}</span>
                                </div>
                            )}
                            {personal.address && (
                                <div className="hipster-fact">
                                    <span className="hipster-fact-icon">◉</span>
                                    <span>{personal.address}</span>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Skills with Bubbles */}
                    <section className="hipster-section">
                        <h2 className="hipster-section-title">
                            <span className="hipster-title-text">SKILLS</span>
                            <span className="hipster-title-sub">languages</span>
                        </h2>
                        {languages.length > 0 && (
                            <div className="hipster-language-bars">
                                {languages.map((lang, i) => (
                                    <div key={lang.id || i} className="hipster-language-bar">
                                        <span className="hipster-lang-name">{lang.name}</span>
                                        <span className="hipster-lang-level">{lang.level}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Bubble Skills Diagram */}
                    {skills.length > 0 && (
                        <section className="hipster-section">
                            <h3 className="hipster-interests-title">interests</h3>
                            <div className="hipster-bubble-container">
                                {skills.slice(0, 7).map((skill, i) => (
                                    <div
                                        key={skill.id || i}
                                        className={`hipster-bubble hipster-bubble-${i + 1}`}
                                    >
                                        <EditableText
                                            tag="span"
                                            value={skill.name || ''}
                                            onChange={onDataChange ? (v) => updateSkill(i, 'name', v) : undefined}
                                            placeholder="Skill"
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Tech Skills */}
                    <section className="hipster-section">
                        <h3 className="hipster-tech-title">IT & programming</h3>
                        <div className="hipster-tech-list">
                            {skills.filter(s => s.category === 'technical').slice(0, 6).map((skill, i) => (
                                <div key={skill.id || i} className="hipster-tech-item">
                                    <span className="hipster-tech-icon">⌘</span>
                                    <EditableText
                                        tag="span"
                                        value={skill.name || ''}
                                        onChange={onDataChange ? (v) => updateSkill(i, 'name', v) : undefined}
                                        placeholder="Skill"
                                    />
                                </div>
                            ))}
                        </div>
                    </section>
                </aside>

                {/* Center Column - Resume */}
                <main className="hipster-main">
                    {/* Short Resume / Experience */}
                    <section className="hipster-main-section">
                        <h2 className="hipster-main-title">{getLabel('experience', lang)}</h2>
                        <div className="hipster-timeline">
                            {experience.map((exp, i) => (
                                <div key={exp.id || i} className="hipster-timeline-item">
                                    <div className="hipster-timeline-date">
                                        <EditableText
                                            tag="span"
                                            value={exp.startDate || ''}
                                            onChange={onDataChange ? (v) => updateExperience(i, 'startDate', v) : undefined}
                                            placeholder="Start"
                                        />–{exp.current ? 'pres' : <EditableText
                                            tag="span"
                                            value={exp.endDate || ''}
                                            onChange={onDataChange ? (v) => updateExperience(i, 'endDate', v) : undefined}
                                            placeholder="End"
                                        />}
                                    </div>
                                    <div className="hipster-timeline-content">
                                        <EditableText
                                            tag="h3"
                                            className="hipster-timeline-title"
                                            value={exp.position || ''}
                                            onChange={onDataChange ? (v) => updateExperience(i, 'position', v) : undefined}
                                            placeholder="Position"
                                        />
                                        <div className="hipster-timeline-company">
                                            <EditableText
                                                tag="span"
                                                value={exp.company || ''}
                                                onChange={onDataChange ? (v) => updateExperience(i, 'company', v) : undefined}
                                                placeholder="Company"
                                            />
                                            {exp.location && <span className="hipster-location">📍</span>}
                                        </div>
                                        <EditableText
                                            tag="p"
                                            className="hipster-timeline-desc"
                                            value={exp.description || ''}
                                            onChange={onDataChange ? (v) => updateExperience(i, 'description', v) : undefined}
                                            placeholder="Description"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Degrees / Education */}
                    <section className="hipster-main-section">
                        <h2 className="hipster-main-title">{getLabel('education', lang)}</h2>
                        <div className="hipster-timeline">
                            {education.map((edu, i) => (
                                <div key={edu.id || i} className="hipster-timeline-item">
                                    <div className="hipster-timeline-date">
                                        <EditableText
                                            tag="span"
                                            value={edu.startDate || ''}
                                            onChange={onDataChange ? (v) => updateEducation(i, 'startDate', v) : undefined}
                                            placeholder="Year"
                                        />
                                    </div>
                                    <div className="hipster-timeline-content">
                                        <EditableText
                                            tag="h3"
                                            className="hipster-timeline-title"
                                            value={edu.degree || ''}
                                            onChange={onDataChange ? (v) => updateEducation(i, 'degree', v) : undefined}
                                            placeholder="Degree"
                                        />
                                        <div className="hipster-timeline-company">
                                            <EditableText
                                                tag="span"
                                                value={edu.institution || ''}
                                                onChange={onDataChange ? (v) => updateEducation(i, 'institution', v) : undefined}
                                                placeholder="Institution"
                                            />
                                            <span className="hipster-edu-icon">🎓</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Certificates */}
                    {showCertificates && certificates && certificates.length > 0 && (
                        <section className="hipster-main-section">
                            <h2 className="hipster-main-title">{getLabel('certificates', lang)}</h2>
                            <div className="hipster-timeline">
                                {certificates.map((cert, i) => (
                                    <div key={cert.id || i} className="hipster-timeline-item hipster-timeline-mini">
                                        <div className="hipster-timeline-date">{cert.date}</div>
                                        <div className="hipster-timeline-content">
                                            <span className="hipster-cert-name">{cert.name}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </main>

                {/* Right Column - Hobbies & More */}
                <aside className="hipster-sidebar-right">
                    {/* Hobbies */}
                    {showHobbies && (
                        <section className="hipster-section">
                            <h2 className="hipster-section-title-right">{getLabel('hobbies', lang)}</h2>
                            <div className="hipster-hobbies-grid">
                                {hobbySource.slice(0, 4).map((item, i) => (
                                    <div key={item.id || i} className="hipster-hobby-item">
                                        <span className="hipster-hobby-icon">🎯</span>
                                        <span>{item.name || item.title}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Publications */}
                    {showPublications && publications && publications.length > 0 && (
                        <section className="hipster-section">
                            <h2 className="hipster-section-title-right">{getLabel('publications', lang)}</h2>
                            <div className="hipster-publications">
                                {publications.map((pub, i) => (
                                    <div key={pub.id || i} className="hipster-pub-item">
                                        <span className="hipster-pub-year">{pub.date}</span>
                                        <EditableText
                                            tag="span"
                                            className="hipster-pub-title"
                                            value={pub.title || ''}
                                            onChange={onDataChange ? (v) => updatePublication(i, 'title', v) : undefined}
                                            placeholder="Title"
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Strengths */}
                    {showProjects && projects && projects.length > 0 && (
                        <section className="hipster-section">
                            <h2 className="hipster-section-title-right">Strengths</h2>
                            <div className="hipster-tags">
                                {projects.slice(0, 3).map((proj, i) => (
                                    <span key={proj.id || i} className="hipster-tag">
                                        {proj.name}
                                    </span>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* References */}
                    <section className="hipster-section">
                        <h2 className="hipster-section-title-right">{getLabel('references', lang)}</h2>
                        <div className="hipster-refs">
                            <div className="hipster-ref-item">Available upon request</div>
                        </div>
                    </section>
                </aside>
            </div>

            {/* Footer */}
            <footer className="hipster-footer">
                <div className="hipster-footer-content">
                    <span>{personal.name}</span>
                    <span>📍 {personal.address}</span>
                    <span>📞 {personal.phone}</span>
                    <span>✉ {personal.email}</span>
                </div>
            </footer>
        </div>
    );
}

export default HipsterCVTemplate;
