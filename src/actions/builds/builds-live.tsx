import React, { useState, useEffect, ReactElement } from 'react'
import { Box, render, Text } from 'ink'

import { getTeam } from '../../common/config.ts'

import { getReposByState, ReposByState } from './data.ts'

type Props = {
    team: string
    initialRepos: ReposByState
}

function BuildsView({ team, initialRepos }: Props): ReactElement {
    const [reposByState, setReposByState] = useState(initialRepos)
    const [counter, setCounter] = useState(0)

    useEffect(() => {
        const timer = setInterval(() => {
            setCounter((previousCounter) => previousCounter + 1)
        }, 100)

        return () => {
            clearInterval(timer)
        }
    }, [])

    const { SUCCESS, FAILURE, CANCELLED, ...rest } = reposByState

    return (
        <Box borderStyle="single">
            <StateView state="SUCCESS" repos={SUCCESS} />
            <StateView state="FAILURE" repos={FAILURE} />
            <StateView state="CANCELLED" repos={CANCELLED} />
            <Text color="green">
                {counter} tests passed {reposByState.SUCCESS.length}
            </Text>
        </Box>
    )
}

function StateView({ state, repos }: { state: string; repos: ReposByState['SUCCESS'] }): ReactElement {
    return (
        <Box borderStyle="single" flexGrow={1}>
            <Text color="green">{state}</Text>
        </Box>
    )
}

export async function checkBuildsLive(): Promise<void> {
    const team = await getTeam()
    const reposByState = await getReposByState(team)

    render(<BuildsView team={team} initialRepos={reposByState} />)
}
