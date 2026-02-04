import { useCallback } from 'react';
import type { ResumeData, StyleSettings } from '../../types/resume';
import { darkenColor } from '../../utils/colorUtils';
import { EditableText } from '../../components/EditableText';
import { getLabel } from '../../lib/i18n/resumeLabels';
import './SidebarCVTemplate.css';

interface SidebarCVTemplateProps {
    data: ResumeData;
    style: StyleSettings;
    onDataChange?: (data: ResumeData) => void;
}

export function SidebarCVTemplate({ data, style, onDataChange }: SidebarCVTemplateProps) {
    const visibility = data.sectionVisibility;
    const showHobbies = visibility?.hobbies ?? (data.hobbies?.length ?? 0) > 0;
    const lang = style.resumeLanguage || 'en';

    const cssVars = {
        '--primary-color': style.primaryColor,
        '--primary-dark': darkenColor(style.primaryColor, 15),
        '--sidebar-width': `${style.sidebarWidth}%`,
        '--secondary-color': '#f5a623',
        '--font-size': `${style.fontSize}pt`,
        '--line-height': style.lineHeight,
        '--scale': style.fontSize / 10,
    } as React.CSSProperties;

    // Helper functions for updating data
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

    const updateHobby = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newHobbies = [...(data.hobbies || [])];
            newHobbies[index] = { ...newHobbies[index], [field]: value };
            onDataChange({ ...data, hobbies: newHobbies });
        }
    }, [data, onDataChange]);

    const updateSocialLink = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newLinks = [...data.socialLinks];
            newLinks[index] = { ...newLinks[index], [field]: value };
            onDataChange({ ...data, socialLinks: newLinks });
        }
    }, [data, onDataChange]);

    return (
        <div className="sidebar-cv-container" style={cssVars}>
            {/* Left Sidebar */}
            <aside className="sidebar-cv-left">
                <header className="sidebar-cv-header">
                    <div className="header-name-section">
                        <h1 className="header-name">
                            <EditableText
                                tag="span"
                                value={(data.personal.name?.split(' ')[0]) || ''}
                                onChange={onDataChange ? (v) => updatePersonal('name', v + ' ' + (data.personal.name?.split(' ').slice(1).join(' ') || '')) : undefined}
                                placeholder="First"
                            /> <span className="name-highlight"><EditableText
                                tag="span"
                                value={(data.personal.name?.split(' ').slice(1).join(' ')) || ''}
                                onChange={onDataChange ? (v) => updatePersonal('name', (data.personal.name?.split(' ')[0] || '') + ' ' + v) : undefined}
                                placeholder="Last"
                            /></span>
                        </h1>
                        <div className="header-divider">|</div>
                        <span className="header-title">RESUME</span>
                    </div>

                    {/* Photo & Intro */}
                    <div className="header-intro">
                        {data.personal.photo && (
                            <img src={data.personal.photo} alt="" className="header-photo" />
                        )}
                        <EditableText
                            tag="p"
                            className="header-summary"
                            value={data.personal.summary || ''}
                            onChange={onDataChange ? (v) => updatePersonal('summary', v) : undefined}
                            placeholder="Your introduction or summary"
                        />
                    </div>

                    {/* Status */}
                    <div className="header-status">
                        <span className="status-icon">💼</span>
                        <span className="status-text">STATUS</span>
                    </div>
                    <EditableText
                        tag="p"
                        className="status-content"
                        value={data.personal.title || ''}
                        onChange={onDataChange ? (v) => updatePersonal('title', v) : undefined}
                        placeholder="Your Title"
                    />
                </header>

                {/* Experience */}
                <section className="sidebar-cv-section">
                    <div className="section-header">
                        <span className="section-icon">📋</span>
                        <span className="section-title">{getLabel('experience', lang).toUpperCase()}</span>
                    </div>

                    {data.experience.map((exp, index) => (
                        <div key={exp.id} className="sidebar-entry">
                            <div className="entry-header">
                                <EditableText
                                    tag="span"
                                    className="entry-title"
                                    value={exp.position || ''}
                                    onChange={onDataChange ? (v) => updateExperience(index, 'position', v) : undefined}
                                    placeholder="Position"
                                />
                                <span className="entry-company">
                                    <EditableText
                                        tag="span"
                                        value={exp.company || ''}
                                        onChange={onDataChange ? (v) => updateExperience(index, 'company', v) : undefined}
                                        placeholder="Company"
                                    />
                                    , <EditableText
                                        tag="span"
                                        value={exp.startDate || ''}
                                        onChange={onDataChange ? (v) => updateExperience(index, 'startDate', v) : undefined}
                                        placeholder="Date"
                                    />
                                </span>
                            </div>
                            {(exp.description || onDataChange) && (
                                <ul className="entry-list">
                                    <li><EditableText
                                        tag="span"
                                        value={exp.description || ''}
                                        onChange={onDataChange ? (v) => updateExperience(index, 'description', v) : undefined}
                                        placeholder="Description"
                                    /></li>
                                </ul>
                            )}
                        </div>
                    ))}
                </section>

                {/* Education */}
                <section className="sidebar-cv-section">
                    <div className="section-header">
                        <span className="section-icon">🎓</span>
                        <span className="section-title">{getLabel('education', lang).toUpperCase()}</span>
                    </div>

                    {data.education.map((edu, index) => (
                        <div key={edu.id} className="sidebar-entry">
                            <div className="entry-header">
                                <span className="entry-title">
                                    <EditableText
                                        tag="span"
                                        value={edu.degree || ''}
                                        onChange={onDataChange ? (v) => updateEducation(index, 'degree', v) : undefined}
                                        placeholder="Degree"
                                    />
                                    {' '}
                                    <EditableText
                                        tag="span"
                                        value={edu.field || ''}
                                        onChange={onDataChange ? (v) => updateEducation(index, 'field', v) : undefined}
                                        placeholder="Field"
                                    />
                                </span>
                                <span className="entry-company">
                                    <EditableText
                                        tag="span"
                                        value={edu.institution || ''}
                                        onChange={onDataChange ? (v) => updateEducation(index, 'institution', v) : undefined}
                                        placeholder="Institution"
                                    />
                                    , <EditableText
                                        tag="span"
                                        value={edu.endDate || ''}
                                        onChange={onDataChange ? (v) => updateEducation(index, 'endDate', v) : undefined}
                                        placeholder="Date"
                                    />
                                </span>
                            </div>
                            {(edu.description || onDataChange) && (
                                <ul className="entry-list">
                                    <li><EditableText
                                        tag="span"
                                        value={edu.description || ''}
                                        onChange={onDataChange ? (v) => updateEducation(index, 'description', v) : undefined}
                                        placeholder="Description"
                                    /></li>
                                </ul>
                            )}
                        </div>
                    ))}
                </section>
            </aside>

            {/* Right Content */}
            <main className="sidebar-cv-right">
                {/* Contact */}
                <section className="right-section contact-section">
                    <h3 className="right-title">CONTACT</h3>
                    <div className="contact-grid">
                        {(data.personal.address || onDataChange) && (
                            <div className="contact-item">
                                <span className="contact-icon">📍</span>
                                <EditableText
                                    tag="span"
                                    value={data.personal.address || ''}
                                    onChange={onDataChange ? (v) => updatePersonal('address', v) : undefined}
                                    placeholder="Address"
                                />
                            </div>
                        )}
                        {(data.personal.phone || onDataChange) && (
                            <div className="contact-item">
                                <span className="contact-icon">📞</span>
                                <EditableText
                                    tag="span"
                                    value={data.personal.phone || ''}
                                    onChange={onDataChange ? (v) => updatePersonal('phone', v) : undefined}
                                    placeholder="Phone"
                                />
                            </div>
                        )}
                        {(data.personal.email || onDataChange) && (
                            <div className="contact-item">
                                <span className="contact-icon">✉️</span>
                                <EditableText
                                    tag="span"
                                    value={data.personal.email || ''}
                                    onChange={onDataChange ? (v) => updatePersonal('email', v) : undefined}
                                    placeholder="Email"
                                />
                            </div>
                        )}
                        {(data.personal.website || onDataChange) && (
                            <div className="contact-item">
                                <span className="contact-icon">🌐</span>
                                <EditableText
                                    tag="span"
                                    value={data.personal.website || ''}
                                    onChange={onDataChange ? (v) => updatePersonal('website', v) : undefined}
                                    placeholder="Website"
                                />
                            </div>
                        )}
                        {data.socialLinks.map((link, i) => (
                            <div key={link.platform} className="contact-item">
                                <span className="contact-icon">{link.icon}</span>
                                <EditableText
                                    tag="span"
                                    value={link.username || ''}
                                    onChange={onDataChange ? (v) => updateSocialLink(i, 'username', v) : undefined}
                                    placeholder="Username"
                                />
                            </div>
                        ))}
                    </div>
                </section>

                {/* Fields */}
                {data.skills.length > 0 && (
                    <section className="right-section">
                        <h3 className="right-title">FIELDS</h3>
                        <div className="fields-grid">
                            {data.skills.filter(s => s.category === 'domain' || true).slice(0, 3).map((skill, i) => (
                                <div key={skill.id} className="field-item">
                                    <span className="field-icon">◇</span>
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

                {/* Technologies */}
                <section className="right-section">
                    <h3 className="right-title">TECHNOLOGIES</h3>
                    <div className="tech-grid">
                        {data.skills.slice(0, 6).map((skill, i) => (
                            <div key={skill.id} className="tech-item">
                                <span className="tech-icon">◇</span>
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

                {/* Tools */}
                <section className="right-section">
                    <h3 className="right-title">TOOLS</h3>
                    <div className="tools-grid">
                        {data.skills.slice(0, 4).map((skill, i) => (
                            <span key={skill.id} className="tool-item">
                                {skill.icon} <EditableText
                                    tag="span"
                                    value={skill.name || ''}
                                    onChange={onDataChange ? (v) => updateSkill(i, 'name', v) : undefined}
                                    placeholder="Tool"
                                />
                            </span>
                        ))}
                    </div>
                </section>

                {/* Activities */}
                {showHobbies && data.hobbies.length > 0 && (
                    <section className="right-section">
                        <h3 className="right-title">ACTIVITIES</h3>
                        <div className="activities-text">
                            {data.hobbies.map((hobby, i) => (
                                <span key={hobby.id || i}>
                                    <EditableText
                                        tag="span"
                                        value={hobby.name || ''}
                                        onChange={onDataChange ? (v) => updateHobby(i, 'name', v) : undefined}
                                        placeholder="Hobby"
                                    />
                                    {i < data.hobbies.length - 1 && ', '}
                                </span>
                            ))}
                        </div>
                    </section>
                )}

                {/* Operating Systems */}
                <section className="right-section">
                    <h3 className="right-title">OPERATING SYSTEMS</h3>
                    <div className="os-grid">
                        <span className="os-item">💻 macOS</span>
                        <span className="os-item">🐧 Linux</span>
                        <span className="os-item">🪟 Windows</span>
                    </div>
                </section>

                {/* QR Code placeholder */}
                <div className="qr-section">
                    <div className="qr-placeholder">QR</div>
                </div>
            </main>
        </div>
    );
}
