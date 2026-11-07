import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { Avatar, Chip, ErrorNote, Loading, useToast, Toast } from '../../ui.jsx';

export default function Teams() {
  const [teams, setTeams] = useState(null);
  const [org, setOrg] = useState(null);
  const [error, setError] = useState(null);
  const { toast, notify, fail } = useToast();

  const load = async () => {
    try {
      const [teamList, orgData] = await Promise.all([api.get('/teams'), api.get('/teams/org')]);
      setTeams(teamList);
      setOrg(orgData);
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const makeLeader = async (member, teamId) => {
    try {
      await api.patch(`/employees/${member.id}`, { isLead: true, teamId });
      await load();
      notify(`${member.name} is now team leader.`);
    } catch (err) {
      fail(err);
    }
  };

  if (error) return <ErrorNote error={error} />;
  if (!teams || !org) return <Loading />;

  return (
    <div className="stack">
      <Toast message={toast.message} error={toast.error} />

      <div className="card">
        <div className="org">
          <div className="tlabel">Leadership</div>
          <div className="pp ceo">
            <Avatar person={{ id: 0, name: org.ceo }} size={48} />
            <div>
              <b>{org.ceo}</b>
              <small>Main Admin</small>
            </div>
          </div>
          <div className="tlink" />
          <div className="tlabel">Managers</div>
          <div className="tier">
            {org.managers.map((manager) => (
              <div className="pp" key={manager.id} style={{ '--tc': 'var(--t-mgmt)' }}>
                <Avatar person={manager} size={44} ring />
                <div>
                  <b>{manager.name}</b>
                  <small>{manager.role}</small>
                </div>
              </div>
            ))}
          </div>
          <div className="tlink" />
          <div className="tlabel">Team leaders</div>
          <div className="tier">
            {org.leaders.length ? (
              org.leaders.map((leader) => (
                <div className="pp" key={leader.id}>
                  <Avatar person={leader} size={44} ring />
                  <div>
                    <b>{leader.name}</b>
                    <small>Team Leader · {teams.find((team) => team.id === leader.teamId)?.name}</small>
                  </div>
                </div>
              ))
            ) : (
              <div className="pp empty">
                <div>
                  <b>No leaders yet</b>
                  <small>Pick a team member below</small>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="teams">
        {teams
          .filter((team) => team.members.length)
          .map((team) => {
            const leader = team.members.find((member) => member.isLead);
            return (
              <div className="tcard" key={team.id} style={{ '--tc': team.color }}>
                <div className="th">
                  <div>
                    <h3>{team.name}</h3>
                    <span className="small muted">
                      {team.members.length} member{team.members.length > 1 ? 's' : ''} · Leader:{' '}
                      {leader ? leader.name : 'not assigned'}
                    </span>
                  </div>
                  <Chip tone="good">{team.members.length} in team</Chip>
                </div>
                <div className="tb">
                  {team.members.map((member) => (
                    <div className="mrow" key={member.id}>
                      <Avatar person={member} size={36} ring />
                      <div className="grow">
                        <b>
                          {member.name} {member.isLead ? <span className="lead">LEAD</span> : null}
                        </b>
                        <small>{member.role}</small>
                      </div>
                      {member.isLead ? null : (
                        <button
                          type="button"
                          className="btn sm ghost"
                          onClick={() => makeLeader(member, team.id)}
                        >
                          Make leader
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
